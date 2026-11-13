import { NextResponse } from 'next/server';
import { cfg } from '@/lib/config';
import { db, audit } from '@/lib/store';
import { activateTier, addPack } from '@/lib/auth';
import { stripe, tierOfPrice } from '@/lib/billing';
import { planOf, packOf } from '@/lib/plans';

export const dynamic = 'force-dynamic';
const byCustomer = async (id: any) => (typeof id === 'string' ? (await db.list('profiles', { stripe_customer_id: id }))[0] : null);

export async function POST(req: Request) {
  if (!cfg.stripeKey || !cfg.stripeWebhookSecret) return new NextResponse('not configured', { status: 503 });
  let event: any;
  try { event = stripe().webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') || '', cfg.stripeWebhookSecret); }
  catch { return new NextResponse('bad signature', { status: 400 }); }
  const o: any = event.data.object;
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const uid = o.client_reference_id || o.metadata?.user_id, tier = o.metadata?.tier;
        if (o.mode === 'payment') { // a pack of extra credits, paid once
          const pack = packOf(o.metadata?.pack), p = uid ? await db.get('profiles', uid) : null;
          if (!pack || !p || o.payment_status !== 'paid' || p.last_event === event.id) break;
          await addPack(p.id, pack.credits, { session: o.id, pack: pack.id });
          await db.update('profiles', p.id, { last_event: event.id, stripe_customer_id: p.stripe_customer_id || o.customer });
          break;
        }
        if (uid && planOf(tier)) await activateTier(uid, tier, { stripe_customer_id: o.customer, stripe_subscription_id: o.subscription, last_event: event.id });
        break;
      }
      case 'invoice.paid': { // each monthly renewal starts a fresh allowance
        const p = await byCustomer(o.customer); if (!p || p.last_event === event.id) break;
        if (o.billing_reason === 'subscription_create') break; // handled by checkout.session.completed
        const line = o.lines?.data?.[0], tier = tierOfPrice(line?.pricing?.price_details?.price || line?.price?.id) || p.tier;
        const end = line?.period?.end ? new Date(line.period.end * 1000).toISOString() : undefined;
        if (planOf(tier)) await activateTier(p.id, tier, { last_event: event.id }, end);
        break;
      }
      case 'invoice.payment_failed': { const p = await byCustomer(o.customer); if (p) await db.update('profiles', p.id, { status: 'past_due' }); break; }
      case 'customer.subscription.updated': {
        const p = await byCustomer(o.customer); if (!p) break;
        const tier = tierOfPrice(o.items?.data?.[0]?.price?.id);
        const patch: any = { stripe_subscription_id: o.id };
        if (o.status === 'active' && tier && tier !== p.tier) { await activateTier(p.id, tier, patch); break; } // plan change
        if (o.status === 'past_due' || o.status === 'unpaid') patch.status = 'past_due';
        if (o.status === 'active') patch.status = 'active';
        await db.update('profiles', p.id, patch);
        break;
      }
      case 'customer.subscription.deleted': { // payment discontinued: access ends
        const p = await byCustomer(o.customer); if (p) await db.update('profiles', p.id, { status: 'canceled', tier: null, credits: 0, pack_credits: 0, stripe_subscription_id: null });
        break;
      }
    }
    await audit(null, `stripe.${event.type}`, { id: event.id });
  } catch (e: any) { console.error('[stripe webhook]', e?.message); return new NextResponse('error', { status: 500 }); }
  return NextResponse.json({ received: true });
}

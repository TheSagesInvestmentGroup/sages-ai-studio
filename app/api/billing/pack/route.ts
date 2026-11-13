import { ok, fail, withUser } from '@/lib/http';
import { db, audit } from '@/lib/store';
import { cfg } from '@/lib/config';
import { packOf } from '@/lib/plans';
import { stripe } from '@/lib/billing';

// Buy a pack of extra credits: a one-time Stripe payment. Credits are added by the webhook once it is paid.
export const POST = (req: Request) => withUser(req, async (user, b) => {
  const pack = packOf(b.pack); if (!pack) return fail(400, 'Choose a credit pack.');
  if (!cfg.stripeKey) return fail(503, 'Payments are not connected yet. Please check back shortly.');
  const s = stripe();
  let customer = user.stripe_customer_id;
  if (!customer) { customer = (await s.customers.create({ email: user.email, name: user.name, metadata: { user_id: user.id } })).id; await db.update('profiles', user.id, { stripe_customer_id: customer }); }
  const session = await s.checkout.sessions.create({
    mode: 'payment', customer, client_reference_id: user.id,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: pack.price * 100, product_data: { name: `The Sages AI Studio: ${pack.credits.toLocaleString('en-US')} extra credits` } } }],
    metadata: { user_id: user.id, pack: pack.id },
    success_url: `${cfg.siteUrl}/studio/billing?credits=1`, cancel_url: `${cfg.siteUrl}/studio/billing`,
  });
  await audit(user.id, 'billing.pack_checkout', { pack: pack.id });
  return ok({ url: session.url });
}, { member: true, limit: 10 });

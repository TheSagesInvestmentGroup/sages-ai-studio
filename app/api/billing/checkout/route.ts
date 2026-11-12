import { ok, fail, withUser } from '@/lib/http';
import { db, audit } from '@/lib/store';
import { cfg, isDemo } from '@/lib/config';
import { planOf } from '@/lib/plans';
import { activateTier } from '@/lib/auth';
import { stripe, priceId } from '@/lib/billing';

export const POST = (req: Request) => withUser(req, async (user, b) => {
  const plan = planOf(b.tier); if (!plan) return fail(400, 'Choose a membership.');
  if (!cfg.stripeKey) {
    // Demo mode only: activate without payment so the studio can be reviewed. Never available once Supabase is configured.
    if (!isDemo) return fail(503, 'Payments are not connected yet. Please check back shortly.');
    await activateTier(user.id, plan.id); await audit(user.id, 'billing.demo_activate', { tier: plan.id });
    return ok({ demo: true });
  }
  const price = priceId(plan.id); if (!price) return fail(503, 'This membership is not available yet.');
  const s = stripe();
  if (user.stripe_subscription_id && user.status === 'active') { // existing member: change plan in the billing portal
    const portal = await s.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${cfg.siteUrl}/studio/billing` });
    return ok({ url: portal.url });
  }
  let customer = user.stripe_customer_id;
  if (!customer) { customer = (await s.customers.create({ email: user.email, name: user.name, metadata: { user_id: user.id } })).id; await db.update('profiles', user.id, { stripe_customer_id: customer }); }
  const session = await s.checkout.sessions.create({
    mode: 'subscription', customer, client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    allowed_payment_method_types: ['card', 'us_bank_account'], // card, or bank account (ACH) when enabled in the Stripe Dashboard
    subscription_data: { metadata: { user_id: user.id, tier: plan.id } },
    metadata: { user_id: user.id, tier: plan.id },
    success_url: `${cfg.siteUrl}/studio/billing?welcome=1`, cancel_url: `${cfg.siteUrl}/pricing`,
  });
  return ok({ url: session.url });
}, { limit: 10 });

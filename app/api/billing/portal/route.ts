import { ok, fail, withUser } from '@/lib/http';
import { cfg } from '@/lib/config';
import { stripe } from '@/lib/billing';

// Members change card or bank details, switch plan, download invoices or cancel here, at any time.
export const POST = (req: Request) => withUser(req, async user => {
  if (!cfg.stripeKey || !user.stripe_customer_id) return fail(400, 'There is no billing account to manage yet.');
  const portal = await stripe().billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${cfg.siteUrl}/studio/billing` });
  return ok({ url: portal.url });
}, { limit: 10 });

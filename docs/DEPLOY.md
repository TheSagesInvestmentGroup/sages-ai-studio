# Going live

Order matters. Each step is independent, so the site can launch with video rendering still switched off.

## 1. Supabase
1. Create a project (the Pro organization, as for The Inspired Sage).
2. SQL editor → paste `supabase/schema.sql` → Run. It creates the tables, row-level security, the credit functions and two storage buckets.
3. Authentication → URL configuration: Site URL = the live domain; add `https://<domain>/**` to redirect URLs.
4. Authentication → Email templates → Confirm signup: link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. The page confirms on a button press, so Outlook Safe Links cannot burn the token.
5. Authentication → SMTP: use the Resend SMTP settings already used for the other Sage apps.
6. Copy the project URL, anon key and service-role key.

## 2. Stripe (the shared "The Sages Investment Group" account)
1. Create one product, "The Sages AI Studio", with five recurring monthly prices: $10, $25, $50, $100, $200. No free trial.
2. Settings → Payment methods: enable cards and **ACH Direct Debit** (bank account and routing number).
3. Settings → Billing → Customer portal: allow cancel at period end, payment method updates, and switching between the five prices.
4. Developers → Webhooks → add `https://<domain>/api/stripe/webhook` with events `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret.
5. Use a restricted key with write access to Checkout Sessions, Customers, Billing Portal, Subscriptions and Refunds, and read access to Charges.

Payouts reach the business checking account through Stripe → Settings → Payouts. The bank account and routing number are entered there, never in this app.

## 3. Netlify
1. Push the repo to GitHub (`TheSagesInvestmentGroup/sages-ai-studio`, private) and import it in Netlify. `netlify.toml` is included.
2. Add every variable from `.env.example` under Site configuration → Environment variables. Set `NEXT_PUBLIC_SITE_URL` to the live URL and `OWNER_EMAIL` to the owner's sign-in email.
3. Deploy, sign up with the owner email, open **Control center** and confirm each service shows "Live".

## 4. Before taking real payments
- Run one full purchase in Stripe test mode and confirm credits appear, then cancel and confirm access ends at period end.
- Render one short production and check the per-scene cost against the Runway invoice (see the credit note in `docs/BLUEPRINT.md`).
- Have a lawyer review `/terms` and `/privacy`.

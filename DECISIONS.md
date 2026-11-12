# DECISIONS.md

1. **Stack = Next.js + Supabase + Stripe + Netlify**, matching the other Sage apps, rather than the FastAPI/S3 option in the spec. One stack to operate.
2. **Demo mode by default**, flipped live per service by adding keys. Follows the spec's "if there are access issues, keep building".
3. **Scenes live inside the project's `plan` JSON**, not a scenes table. Simpler versioning and restore; revisit if analytics per scene are needed.
4. **Storyboard animatic when video is not connected**, clearly labelled. It is a real deliverable (pre-visualisation), not a fake render.
5. **Runway as the first video vendor** because its API is documented, current, and fronts three models. Sora 2 and Veo 3.1 preview were closed.
6. **Subscription plus credits**, credits tied to seconds rendered. No unlimited plans.
7. **No voice sample collection** until a voice provider can use it. Collecting biometric data with no use is a liability.
8. **Bank and routing numbers are never collected in the app.** Members pay by ACH through Stripe Checkout; the owner's payout account is set in Stripe.
9. **Admin plan changes do not charge.** Money only moves through Stripe Checkout, the Customer Portal, or an explicit refund.
10. **The spec's "six tiers" lists five.** Five are built.

# CLAUDE.md — The Sages AI Studio

Owner: Bilal, The Sages Investment Group. He runs deployment himself with plain-English guidance; assume no prior Next.js or Postgres experience.

## Commands
`npm run dev` · `npm test` · `npm run typecheck` · `npm run build`

## Rules
- Never present mocked or simulated output as a finished feature. If a provider is not connected, say so in the UI.
- Never invent career facts. Bio scripts use only member-approved facts (`lib/career.ts`).
- Every route goes through `withUser` (`lib/http.ts`) and checks ownership with `owned()`.
- Credits: charge before submit, refund on failure, only render scenes that changed.
- No free trials. Prices live in Stripe; `lib/plans.ts` amounts are display only.
- Keep `lib/director.ts` and `lib/career.ts` pure and covered by `tests/`.
- Route files may only export HTTP handlers and Next config; put helpers in `lib/`.

## Map
`lib/` logic · `app/api/` routes · `app/studio/` member pages · `app/admin/` owner · `app/p/[slug]` public share and portfolio · `components/Player.tsx` preview and export · `supabase/schema.sql` · `docs/`

See MEMORY.md (state), DECISIONS.md (why), TASKS.md (next).

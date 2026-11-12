# The Sages AI Studio

*Imagine it. Create it. Bring it to life.*

An AI production studio for members: describe an idea, choose one of three creative treatments, get a scene-by-scene production plan, direct changes in plain words, render, and share. Includes the Bio & Résumé Studio, five paid membership tiers, a support assistant and an owner control center.

Stack: Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · Stripe · Netlify. Same stack as Sage Sports 360 and The Inspired Sage.

## Run it now (demo mode, no accounts)

```bash
npm install
npm run dev        # http://localhost:3000
```

With no environment variables the app runs in **demo mode**: data is kept in `.data/`, choosing a plan activates it without payment, the first account created is the owner, and productions are delivered as narrated storyboard animatics. A "Demo mode" badge shows in the header.

```bash
npm test           # 12 unit tests: scene timing, selective regeneration, credits, résumé parsing
npm run build      # production build
```

## What is real and what needs a key

| Area | Works with no keys | Needs |
|---|---|---|
| Accounts, onboarding, projects, characters, assets, versions | Yes (local demo store) | Supabase for real members |
| Three treatments, scene plans, conversational edits | Yes (built-in rule-based director) | `DEEPSEEK_API_KEY` (or any OpenAI-compatible key) for far better writing |
| Preview with captions and narration | Yes (storyboard animatic, browser voice) | — |
| Rendered video | No | `RUNWAY_API_KEY` |
| Studio-quality narration | No | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` |
| Memberships and payments | Demo activation only | Stripe keys and five price IDs |
| Support escalation email | Ticket is flagged in the control center | `RESEND_API_KEY` |

See `docs/BLUEPRINT.md` for architecture, the provider matrix, known limits and the roadmap, and `docs/DEPLOY.md` to go live.

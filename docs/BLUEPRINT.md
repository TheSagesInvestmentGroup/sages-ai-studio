# Blueprint

## Architecture

```
Browser (Next.js pages, canvas player)
   │  JSON over same-origin fetch
Next.js route handlers on Netlify  ── origin check · rate limit · session · membership gate
   ├─ lib/director.ts    Creative Director, Story Architect, conversational editor (pure, unit tested)
   ├─ lib/career.ts      Bio & Résumé: fact extraction, script from approved facts only
   ├─ lib/production.ts  charge credits → submit scene → poll → refund failures
   ├─ lib/providers.ts   adapters: language (OpenAI-compatible, failover), video (Runway), voice (ElevenLabs), email (Resend)
   ├─ lib/store.ts       Supabase (service role, server only) or local JSON in demo mode
   └─ lib/billing.ts     Stripe Checkout, Customer Portal, webhook, refunds
Supabase: Postgres + RLS · Auth · Storage (private `assets`, `renders`)
```

Rendering is asynchronous: a scene is submitted, the page polls every 6 seconds, and each poll checks the provider. No request waits for a render, so it fits serverless time limits.

## Customer flow
Imagine (prompt, style, length, format) → Enhance (three treatments; combine, keep the original, or surprise me) → Create (scene plan with camera, light, narration, sound, music and cost per scene) → Perfect (plain-language edits; only changed scenes are marked for a new render) → Publish (share link, social links, export).

## Provider matrix (checked 12 November 2026)

| Area | Integrated | Notes |
|---|---|---|
| Writing and reasoning | Any OpenAI-compatible API: DeepSeek, OpenAI, Grok, Qwen, Kimi, GLM, Llama hosts | Tried in order; built-in writer is the last fallback |
| Video | Runway API `text_to_video`, default `gemini_omni_flash_1.2` ($0.07/s at 720p); `kling_4`, `gen4.5` and others via `RUNWAY_MODEL` | 3–10 s clips, 16:9 or 9:16 |
| Voice | Runway API `text_to_speech` (`eleven_v3`, preset voice) | One studio voice per deployment; same account and credits as video |
| Not integrated | Sora 2 | OpenAI's documentation states the Videos API was shut down on 24 September 2026 |
| Not integrated | Veo 3.1 preview | Google's documentation states the preview models were shut down on 22 October 2026 |
| Not integrated | Kling, Higgsfield, Luma, Midjourney, Flux, Suno | No adapter yet. Midjourney and Suno have no official public API that we could verify |

Adding a video vendor means writing two functions, `videoSubmit` and `videoStatus`, in `lib/providers.ts`.

## Credits
Video costs 4 credits per second, narration 2 per scene. Monthly allowances: 260 / 640 / 1,300 / 2,600 / 5,200, which is 65 / 160 / 325 / 650 / 1,300 seconds of video. They are set from Runway's published price for `gemini_omni_flash_1.2` at 720p ($0.07 per second) so a fully used allowance costs about 45% of the fee, before Stripe fees. A dearer model (`kling_4` is about $0.16 per second) needs smaller allowances or higher prices. Confirm against the first real Runway usage report.

## Security
Sessions in HTTP-only cookies · origin check on every state-changing request · per-IP rate limits · server-side ownership check on every id · row-level security · atomic credit spend in Postgres · private storage with short-lived signed links · upload type and size allow-list · Stripe handles all card and bank data · consent records for likeness · audit log · security headers (HSTS, nosniff, frame deny, permissions policy) · content rules before generation · AI-generated label on every preview.

## Known limits
1. **No stitched MP4 with sound.** Rendered scenes download individually as MP4. "Export video file" records the full preview in the browser with picture and captions but no audio. A single mastered file needs an FFmpeg worker (Render is the natural host).
2. **No music or sound-effect generation.** Direction is written per scene; nothing is synthesised.
3. **No animated avatar or voice replica** in the Bio & Résumé Studio. It uses a narrator and a presenter photo. No voice sample is collected.
4. **Image-to-video, video-to-video, lip sync and green screen** are not built. Uploads are stored and classified but not yet fed to the video model.
5. **Uploads are not virus-scanned.** They are type- and size-checked, stored privately and served with a sandboxing header.
6. **Rate limits are per server instance**, so they slow abuse rather than cap it. Credits are the hard cap.
7. **Character consistency** relies on restating the description in every scene prompt. Models still drift.
8. **Direct posting to social networks** is by share link. Publishing through Postiz is a small follow-on.
9. **Team workspaces, reviewer comments, marketplace, credit packs, MFA and social sign-in** are not built.
10. **Autonomous maintenance agents** are not part of this app. Nothing here updates itself.
11. The Supabase, Stripe, Runway and Resend code paths have been type-checked and built but **not exercised against live accounts**.

## Roadmap
- **Phase 1 (this delivery):** accounts, five tiers, credits, treatments, scene planning, conversational editing, versions, characters, assets, Bio & Résumé Studio with portfolio page, share links, support assistant, control center, Runway video and voice adapters.
- **Phase 2:** FFmpeg render worker for one mastered MP4 with narration and music; image-to-video from uploaded references; second video vendor for failover; Postiz publishing.
- **Phase 3:** music and sound generation; avatar and consented voice provider; subtitles export (SRT); localisation; team seats and comments.
- **Phase 4:** credit packs, template marketplace, API access.

import { ok, withUser, clean } from '@/lib/http';
import { isOwner, membership } from '@/lib/auth';
import { db } from '@/lib/store';
import { INTERESTS } from '@/lib/plans';
import { isDemo, cfg } from '@/lib/config';
import { videoLive, voiceLive } from '@/lib/providers';
import { llmProviders } from '@/lib/config';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withUser(req, async user => {
  const m = membership(user);
  const ledger = new URL(req.url).searchParams.get('ledger') ? await db.list('credit_ledger', { user_id: user.id }, { order: 'created_at', limit: 25 }) : undefined;
  return ok({
    ledger,
    user: { id: user.id, email: user.email, name: user.name, interests: user.interests || [], onboarded: !!user.onboarded, tier: user.tier, status: user.status, credits: user.credits, pack_credits: user.pack_credits || 0, videos_used: user.videos_used, period_end: user.period_end },
    member: m.active, plan: m.plan, owner: isOwner(user), demo: isDemo,
    engines: { video: videoLive(), voice: voiceLive(), writer: llmProviders().length > 0, payments: !!cfg.stripeKey },
  });
}, { limit: 240 });

export const PATCH = (req: Request) => withUser(req, async (user, b) => {
  const patch: any = {};
  if (typeof b.name === 'string') patch.name = clean(b.name, 80);
  if (Array.isArray(b.interests)) patch.interests = b.interests.map((x: any) => clean(x, 40)).filter((x: string) => INTERESTS.includes(x) || x.length > 1).slice(0, 30);
  if (b.onboarded === true) patch.onboarded = true;
  return ok({ user: await db.update('profiles', user.id, patch) });
});

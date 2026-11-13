import { ok, fail, withUser, clean } from '@/lib/http';
import { owned, audit } from '@/lib/store';
import { isOwner } from '@/lib/auth';
import { cfg } from '@/lib/config';
import { publishLive, postizChannels, postizPublish } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
type Ctx = { params: { id: string } };

// Social publishing through the studio owner's Postiz account. Owner only.
export const GET = (req: Request, { params }: Ctx) => withUser(req, async user => {
  if (!isOwner(user) || !publishLive()) return fail(404, 'Not found.');
  if (!(await owned('projects', params.id, user.id))) return fail(404, 'We could not find that project.');
  const r = await postizChannels();
  return r.channels ? ok({ channels: r.channels }) : fail(502, r.error || 'Postiz did not respond.');
}, { limit: 60 });

export const POST = (req: Request, { params }: Ctx) => withUser(req, async (user, b) => {
  if (!isOwner(user) || !publishLive()) return fail(404, 'Not found.');
  const p = await owned('projects', params.id, user.id); if (!p) return fail(404, 'We could not find that project.');
  if (!p.shared || !p.share_slug) return fail(400, 'Switch on the share link first, so the post has something to open.');
  const caption = clean(b.caption, 1200); if (caption.length < 3) return fail(400, 'Write a caption for the post.');
  const ids: string[] = Array.isArray(b.channelIds) ? b.channelIds.map(String).slice(0, 12) : [];
  const all = await postizChannels(); if (!all.channels) return fail(502, all.error || 'Postiz did not respond.');
  const chosen = all.channels.filter(c => ids.includes(c.id) && c.ok);
  if (!chosen.length) return fail(400, 'Choose at least one channel.');
  let at: string | undefined;
  if (b.at) { const t = new Date(String(b.at)).getTime(); if (!Number.isFinite(t) || t < Date.now() + 60_000) return fail(400, 'Choose a time at least a minute from now, or leave it empty to post now.'); at = new Date(t).toISOString(); }
  const r = await postizPublish(chosen, `${caption}\n\n${cfg.siteUrl}/p/${p.share_slug}`, at);
  if (!r.ok) return fail(502, r.error || 'The post was not accepted.');
  await audit(user.id, 'project.publish', { project: p.id, channels: chosen.map(c => c.network), at: at || 'now' });
  return ok({ posted: chosen.length, at: at || null });
}, { limit: 10 });

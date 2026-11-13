import { ok, fail, withUser } from '@/lib/http';
import { db, owned, audit } from '@/lib/store';
import { spendCredits, addCredits } from '@/lib/auth';
import { signedUrl } from '@/lib/files';
import { isDemo } from '@/lib/config';
import { videoLive, voiceCloneCreate, avatarCreate, resourceStatus } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Ctx = { params: { id: string } };
const COST = 20; // credits to build a voice or an avatar

// Turn a consented voice recording into the member's own narrator voice, or a
// consented photo into a presenter avatar. Consent was recorded when the file was uploaded.
export const POST = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const a = await owned('assets', params.id, user.id); if (!a || !a.ready) return fail(404, 'File not found.');
  if (isDemo || !videoLive()) return fail(503, 'Voice and avatar creation is not connected yet.');
  const kind = a.role === 'voice' && a.kind === 'audio' ? 'voice' : a.role === 'avatar' && a.kind === 'image' ? 'avatar' : null;
  if (!kind) return fail(400, 'Upload a voice recording as “My voice sample” or a photo as “My presenter photo” first.');
  const [consent] = await db.list('consents', { user_id: user.id, ref: a.id });
  if (!consent) return fail(400, 'There is no consent on record for this file. Upload it again and tick the consent box.');
  if (a.meta?.rw_id && a.meta.status !== 'FAILED') return ok({ asset: a });
  if (!(await spendCredits(user, COST, kind === 'voice' ? 'Create my voice' : 'Create presenter avatar', { asset: a.id }))) return fail(402, `You need ${COST} credits for this.`, { needsPlan: true });
  const url = await signedUrl(a.path, 3600);
  const name = `${user.name || 'Member'} ${kind}`.slice(0, 48);
  const r = url ? (kind === 'voice' ? await voiceCloneCreate(name, url) : await avatarCreate(name, url)) : { error: 'The file could not be read.' };
  if (r.error || !r.id) { await addCredits(user.id, COST, `Refund: ${kind} was not accepted`, { asset: a.id }); return fail(502, r.error || 'The request was not accepted.'); }
  await audit(user.id, `${kind}.create`, { asset: a.id });
  return ok({ asset: await db.update('assets', a.id, { meta: { ...(a.meta || {}), kind, rw_id: r.id, status: 'PROCESSING' } }) });
}, { member: true, limit: 10 });

// Check whether the voice or avatar is ready.
export const GET = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const a = await owned('assets', params.id, user.id); if (!a) return fail(404, 'File not found.');
  if (!a.meta?.rw_id || a.meta.status !== 'PROCESSING') return ok({ asset: a });
  const status = await resourceStatus(a.meta.kind === 'voice' ? 'voices' : 'avatars', a.meta.rw_id);
  if (status === 'PROCESSING') return ok({ asset: a });
  if (status === 'FAILED') await addCredits(user.id, COST, `Refund: ${a.meta.kind} could not be created`, { asset: a.id });
  return ok({ asset: await db.update('assets', a.id, { meta: { ...a.meta, status } }) });
}, { limit: 120 });

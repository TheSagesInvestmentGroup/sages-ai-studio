import { ok, fail, withUser } from '@/lib/http';
import { owned, db } from '@/lib/store';
import { produce } from '@/lib/production';
import { estimate } from '@/lib/director';
import { voiceLive } from '@/lib/providers';

export const maxDuration = 60;

export const POST = (req: Request, { params }: { params: { id: string } }) => withUser(req, async (user, b) => {
  const p = await owned('projects', params.id, user.id); if (!p) return fail(404, 'We could not find that project.');
  const r: any = await produce(user, p, Array.isArray(b.sceneIds) ? b.sceneIds.map(String) : undefined);
  if (r.error) return fail(r.status, r.error, { needsPlan: r.status === 402 });
  const me = await db.get('profiles', user.id);
  return ok({ ...r, credits: me?.credits, estimate: estimate(r.project.plan, voiceLive()) });
}, { member: true, limit: 12 });

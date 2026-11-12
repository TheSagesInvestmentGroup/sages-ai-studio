import { ok, fail, withUser } from '@/lib/http';
import { owned, db } from '@/lib/store';
import { poll } from '@/lib/production';
import { estimate } from '@/lib/director';
import { voiceLive } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = (req: Request, { params }: { params: { id: string } }) => withUser(req, async user => {
  const p = await owned('projects', params.id, user.id); if (!p) return fail(404, 'We could not find that project.');
  const project = await poll(p), me = await db.get('profiles', user.id);
  return ok({ project, credits: me?.credits, estimate: project.plan ? estimate(project.plan, voiceLive()) : null });
}, { limit: 120 });

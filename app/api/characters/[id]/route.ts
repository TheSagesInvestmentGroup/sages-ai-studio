import { ok, fail, withUser } from '@/lib/http';
import { db, owned, now } from '@/lib/store';
import { pickCharacter as pick } from '@/lib/fields';

type Ctx = { params: { id: string } };
export const PATCH = (req: Request, { params }: Ctx) => withUser(req, async (user, b) => {
  const c = await owned('characters', params.id, user.id); if (!c) return fail(404, 'Character not found.');
  return ok({ character: await db.update('characters', c.id, { ...pick(b), updated_at: now() }) });
}, { member: true });
export const DELETE = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const c = await owned('characters', params.id, user.id); if (!c) return fail(404, 'Character not found.');
  await db.remove('characters', c.id); return ok();
});

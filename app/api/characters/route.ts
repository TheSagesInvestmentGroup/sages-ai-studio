import { ok, fail, withUser } from '@/lib/http';
import { pickCharacter as pick } from '@/lib/fields';
import { db, now } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withUser(req, async user => ok({ characters: await db.list('characters', { user_id: user.id }, { order: 'created_at' }) }));

export const POST = (req: Request) => withUser(req, async (user, b) => {
  const c: any = pick(b);
  if (!c.name || !c.appearance) return fail(400, 'Give the character a name and describe how they look.');
  if (b.realPerson && !b.consent) return fail(400, 'A character based on a real person needs that person’s consent on record.');
  const row = await db.insert('characters', { user_id: user.id, ...c, real_person: !!b.realPerson, updated_at: now() });
  if (b.realPerson) await db.insert('consents', { user_id: user.id, kind: 'likeness', subject: c.name, statement: 'Member confirmed they are this person or hold their written permission.', ref: row.id });
  return ok({ character: row });
}, { member: true });

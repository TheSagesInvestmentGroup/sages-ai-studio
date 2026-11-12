import { ok, fail, withUser, clean } from '@/lib/http';
import { db, owned, now } from '@/lib/store';
import { answer, escalate } from '@/lib/support';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = (req: Request) => withUser(req, async user => ok({ tickets: await db.list('tickets', { user_id: user.id }, { order: 'updated_at' }) }));

export const POST = (req: Request) => withUser(req, async (user, b) => {
  const message = clean(b.message, 2000); if (message.length < 2) return fail(400, 'Type your question.');
  let t = b.ticketId ? await owned('tickets', b.ticketId, user.id) : null;
  if (!t) t = await db.insert('tickets', { user_id: user.id, email: user.email, name: user.name, subject: message.slice(0, 80), status: 'open', messages: [], updated_at: now() });
  const messages = [...t.messages, { role: 'member', text: message, at: now() }];
  const a = await answer(message, t.messages);
  let status = t.status;
  if (a.major || b.escalate) {
    const emailed = await escalate({ email: user.email, name: user.name }, t.id, message);
    status = 'escalated';
    messages.push({ role: 'agent', text: `${a.text ? a.text + ' ' : ''}I have passed this to the studio owner, who handles requests like this personally. ${emailed ? 'They have been emailed and will reply to you here and by email.' : 'It is flagged in their control center and they will reply to you here.'}`, at: now() });
  } else messages.push({ role: 'agent', text: a.text, at: now() });
  return ok({ ticket: await db.update('tickets', t.id, { messages, status, updated_at: now() }) });
}, { limit: 20 });

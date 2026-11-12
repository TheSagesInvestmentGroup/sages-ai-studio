import { ok, fail, withUser, clean } from '@/lib/http';
import { db, owned, now } from '@/lib/store';
import { applyEdit, estimate, policyCheck } from '@/lib/director';
import { snapshot } from '@/lib/production';
import { voiceLive } from '@/lib/providers';

export const maxDuration = 60;

// Conversational editor: "Make the scene more dramatic", "Add a sunset", "Turn this into a 30-second commercial".
export const POST = (req: Request, { params }: { params: { id: string } }) => withUser(req, async (user, b) => {
  const p = await owned('projects', params.id, user.id); if (!p) return fail(404, 'We could not find that project.');
  if (!p.plan) return fail(400, 'Choose a creative direction first, then tell the director what to change.');
  const instruction = clean(b.instruction, 600); if (instruction.length < 3) return fail(400, 'Tell the director what to change.');
  const check = policyCheck(instruction); if (!check.ok) return fail(422, check.reason!);
  const r = await applyEdit(p.plan, instruction, b.sceneId || null);
  const rerender = r.plan.scenes.filter(s => s.status === 'stale').map(s => s.id);
  const chat = [...(p.chat || []), { role: 'you', text: instruction, at: now() }, { role: 'director', text: r.reply, changed: r.changed, at: now() }].slice(-40);
  const patch: any = { chat, updated_at: now() };
  if (r.changed.length || JSON.stringify(r.plan) !== JSON.stringify(p.plan)) { patch.plan = r.plan; patch.versions = snapshot(p, `Before: ${instruction.slice(0, 50)}`); if (r.retimed) patch.duration = r.retimed; }
  const project = await db.update('projects', p.id, patch);
  return ok({ project, reply: r.reply, changed: r.changed, rerender, rerenderCost: estimate(r.plan, voiceLive(), rerender).credits, estimate: estimate(r.plan, voiceLive()) });
}, { member: true, limit: 30 });

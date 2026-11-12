import { ok, fail, withUser, clean } from '@/lib/http';
import { db, now, audit } from '@/lib/store';
import { membership } from '@/lib/auth';
import { STYLES, ASPECTS } from '@/lib/plans';
import { policyCheck, treatments, buildPlan, subjectOf } from '@/lib/director';
import { briefOf } from '@/lib/production';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = (req: Request) => withUser(req, async user => {
  const rows = await db.list('projects', { user_id: user.id }, { order: 'updated_at' });
  return ok({ projects: rows.map(p => ({ id: p.id, title: p.title, prompt: p.prompt, style: p.style, duration: p.duration, aspect: p.aspect, status: p.status, kind: p.kind, folder: p.folder || '', scenes: p.plan?.scenes?.length || 0, updated_at: p.updated_at })) });
}, { limit: 240 });

export const POST = (req: Request) => withUser(req, async (user, b) => {
  const prompt = clean(b.prompt, 3000);
  if (prompt.length < 8) return fail(400, 'Describe your idea in a sentence or two.');
  const check = policyCheck(prompt); if (!check.ok) return fail(422, check.reason!);
  const plan = membership(user).plan!;
  const duration = Math.max(9, Math.min(180, Math.round(+b.duration || 30)));
  if (duration > plan.maxSeconds) return fail(402, `${plan.name} productions run up to ${plan.maxSeconds} seconds. Choose a shorter length or upgrade.`, { needsPlan: true });
  const base: any = {
    user_id: user.id, kind: 'production', prompt, style: STYLES.includes(b.style) ? b.style : 'Cinematic', duration,
    aspect: ASPECTS.some(a => a.id === b.aspect) ? b.aspect : '16:9', category: clean(b.category, 60), mode: b.mode === 'pro' ? 'pro' : 'quick',
    cast_ids: Array.isArray(b.castIds) ? b.castIds.slice(0, 6).map(String) : [], use_brand: !!b.useBrand && plan.brand,
    title: (t => t.charAt(0).toUpperCase() + t.slice(1))(subjectOf(prompt).split(/\s+/).slice(0, 7).join(' ')), status: 'concept', chat: [], versions: [], shared: false, counted: false, updated_at: now(),
  };
  const brief = { ...(await briefOf(base)), interests: user.interests };
  const t = await treatments(brief);
  base.treatments = t.list; base.treatment_source = t.source;
  if (b.magic) { // One-Click Movie Magic: the director picks and plans in one step.
    const pick = t.list[Math.floor(Math.random() * t.list.length)];
    const built = await buildPlan(brief, pick);
    Object.assign(base, { chosen: pick.key, plan: built.plan, plan_source: built.source, title: built.plan.title, status: 'planned' });
  }
  const project = await db.insert('projects', base);
  await audit(user.id, 'project.create', { project: project.id });
  return ok({ project });
}, { member: true, limit: 20 });

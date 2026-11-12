import { ok, fail, withUser, clean } from '@/lib/http';
import { db, now, audit } from '@/lib/store';
import { membership } from '@/lib/auth';
import { careerPlan, Facts } from '@/lib/career';

const S = (v: any, n = 200) => clean(v, n), A = (v: any, n = 12, len = 300) => (Array.isArray(v) ? v.map(x => S(x, len)).filter(Boolean).slice(0, n) : []);

export const POST = (req: Request) => withUser(req, async (user, b) => {
  const plan = membership(user).plan!; if (!plan.bio.enabled) return fail(402, 'The Bio & Résumé Studio is not part of your membership.', { needsPlan: true });
  if (!b.confirmed) return fail(400, 'Review your career facts and confirm they are accurate before we write the script.');
  const f = b.facts || {};
  const facts: Facts = { name: S(f.name, 80), headline: S(f.headline, 140), summary: S(f.summary, 600), roles: (Array.isArray(f.roles) ? f.roles : []).slice(0, 12).map((r: any) => ({ title: S(r?.title, 100), company: S(r?.company, 100), dates: S(r?.dates, 40), highlights: A(r?.highlights, 5) })), education: A(f.education), credentials: A(f.credentials), skills: A(f.skills, 20, 40) };
  if (!facts.name) return fail(400, 'Add your name.');
  const o = b.options || {};
  const seconds = Math.max(20, Math.min(plan.bio.maxSeconds, Math.round(+o.seconds || 60)));
  const attachments = A(b.attachments, plan.bio.attachments, 60);
  const mine = new Set((await db.list('assets', { user_id: user.id })).map(a => a.id));
  const kind = ['Video résumé', 'Professional biography', 'Executive introduction', 'Cover letter video'].includes(o.kind) ? o.kind : 'Video résumé';
  const cp = careerPlan(facts, { style: ['Executive', 'Corporate', 'Cinematic', 'Conversational', 'Storytelling'].includes(o.style) ? o.style : 'Executive', person: o.person === 'third' ? 'third' : 'first', structure: ['chronological', 'achievement', 'biography'].includes(o.structure) ? o.structure : 'chronological', seconds, maxScenes: plan.bio.scenes + 2, kind });
  const project = await db.insert('projects', {
    user_id: user.id, kind: 'bio', title: cp.title, prompt: `${kind} for ${facts.name}`, style: 'Corporate', duration: cp.scenes.reduce((a, s) => a + s.seconds, 0), aspect: o.aspect === '9:16' ? '9:16' : '16:9', category: kind, mode: 'quick',
    cast_ids: [], status: 'planned', chat: [], versions: [], shared: false, counted: false, plan: cp, plan_source: 'facts', updated_at: now(),
    portfolio: { facts, links: A(b.links, 8, 200).filter(l => /^https:\/\//i.test(l)), attachments: attachments.filter(id => mine.has(id)), avatar: mine.has(b.avatarId) ? b.avatarId : null, disclosure: true, confirmed_at: now() },
  });
  await audit(user.id, 'bio.create', { project: project.id, facts_confirmed: true });
  return ok({ project });
}, { member: true, limit: 15 });

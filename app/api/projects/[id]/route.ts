import crypto from 'node:crypto';
import { ok, fail, withUser, clean } from '@/lib/http';
import { db, owned, now, audit } from '@/lib/store';
import { membership, spendCredits } from '@/lib/auth';
import { buildPlan, estimate, Plan, timeScenes, policyCheck } from '@/lib/director';
import { briefOf, snapshot } from '@/lib/production';
import { voiceLive, videoLive, musicSubmit, publishLive } from '@/lib/providers';
import { isOwner } from '@/lib/auth';
import { ASPECTS, VOICES } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
type Ctx = { params: { id: string } };
const view = (p: any, owner = false) => ({ project: p, estimate: p.plan ? estimate(p.plan, voiceLive()) : null, engines: { video: videoLive(), voice: voiceLive(), publish: owner && publishLive() } });

export const GET = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const p = await owned('projects', params.id, user.id);
  return p ? ok(view(p, isOwner(user))) : fail(404, 'We could not find that project.');
}, { limit: 240 });

export const DELETE = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const p = await owned('projects', params.id, user.id); if (!p) return fail(404, 'We could not find that project.');
  await db.remove('projects', p.id); await audit(user.id, 'project.delete', { project: p.id });
  return ok();
});

export const PATCH = (req: Request, { params }: Ctx) => withUser(req, async (user, b) => {
  const p = await owned('projects', params.id, user.id); if (!p) return fail(404, 'We could not find that project.');
  const plan: Plan | undefined = p.plan, tier = membership(user).plan!;
  const save = async (patch: any) => ok(view(await db.update('projects', p.id, { ...patch, updated_at: now() }), isOwner(user)));
  const copy = (extra: any) => { const { id, created_at, ...rest } = p; return db.insert('projects', { ...rest, shared: false, share_slug: null, counted: false, chat: [], versions: [], updated_at: now(), ...extra }); };
  const stripRenders = (pl: Plan): Plan => ({ ...pl, scenes: pl.scenes.map(s => ({ ...s, status: 'planned', clip_url: null, voice_url: null, job_id: null, approved: false })) });

  switch (b.op) {
    case 'choose': { // pick a treatment, keep the original prompt unchanged, or let the director surprise you
      const brief = await briefOf(p);
      const list = p.treatments || [];
      let t = b.key === 'original' ? null : b.key === 'surprise' ? list[Math.floor(Math.random() * list.length)] : list.find((x: any) => x.key === b.key);
      if (Array.isArray(b.combine) && b.combine.length > 1) { // combine elements of several treatments
        const parts = list.filter((x: any) => b.combine.includes(x.key));
        if (parts.length > 1) t = { key: parts.map((x: any) => x.key).join('+'), name: parts.map((x: any) => x.name).join(' + '), pitch: parts[0].pitch, tone: parts.map((x: any) => x.tone).join('; '), look: parts[0].look, sound: parts[parts.length - 1].sound, hook: parts[parts.length - 1].hook };
      }
      const built = await buildPlan(brief, t || null);
      return save({ chosen: t?.key || 'original', plan: built.plan, plan_source: built.source, title: built.plan.title, status: 'planned', versions: p.plan ? snapshot(p, 'Before new direction') : [] });
    }
    case 'voice': { // choose the narrator; picture is untouched, narration is re-recorded
      if (!plan) return fail(400, 'No scenes yet.');
      if (String(b.preset).startsWith('custom:')) { // the member's own cloned voice
        const mine = (await db.list('assets', { user_id: user.id })).some(a => a.meta?.kind === 'voice' && a.meta.status === 'READY' && `custom:${a.meta.rw_id}` === b.preset);
        if (!mine) return fail(400, 'That voice is not ready yet.');
      } else if (!VOICES.includes(b.preset)) return fail(400, 'Choose a narrator voice from the list.');
      (plan as any).voice_preset = b.preset;
      plan.scenes.forEach((s: any) => { s.voice_url = null; s.voice_job = null; s.voice_failed = false; if (s.avatar_id && s.clip_url) s.status = 'stale'; });
      return save({ plan });
    }
    case 'music': { // compose an instrumental soundtrack for the whole production
      if (!plan) return fail(400, 'No scenes yet.');
      if (!videoLive()) return fail(503, 'Music is not connected yet.');
      if ((plan as any).music_job) return fail(400, 'Your soundtrack is already being composed.');
      const seconds = plan.scenes.reduce((a, s) => a + s.seconds, 0), cost = Math.max(4, Math.ceil(seconds / 8));
      if (!(await spendCredits(user, cost, 'Compose soundtrack', { project: p.id }))) return fail(402, `You need ${cost} credits for a soundtrack.`, { needsPlan: true });
      const r = await musicSubmit(`${clean(b.prompt, 300) || plan.music_direction}. Mood: ${plan.tone}. Instrumental film score, no vocals.`, seconds);
      if (!r.id) return fail(502, r.error || 'The soundtrack request was not accepted.');
      Object.assign(plan as any, { music_job: r.id, music_cost: cost, music_error: null });
      return save({ plan });
    }
    case 'musicOff': { if (plan) { (plan as any).music_url = null; } return save({ plan }); }
    case 'sceneRef': { // start a scene from one of the member's uploaded images
      if (!plan) return fail(400, 'No scenes yet.');
      const sc: any = plan.scenes.find(s => s.id === b.sceneId); if (!sc) return fail(404, 'Scene not found.');
      if (b.assetId) { const a = await owned('assets', String(b.assetId), user.id); if (!a || a.kind !== 'image' || !a.ready) return fail(400, 'Choose one of your uploaded images.'); sc.ref_asset = a.id; sc.ref_name = a.name; sc.avatar_id = null; }
      else { sc.ref_asset = null; sc.ref_name = null; }
      if (sc.clip_url) sc.status = 'stale'; sc.approved = false;
      return save({ plan });
    }
    case 'sceneAvatar': { // have the member's presenter avatar speak this scene's narration
      if (!plan) return fail(400, 'No scenes yet.');
      const sc: any = plan.scenes.find(s => s.id === b.sceneId); if (!sc) return fail(404, 'Scene not found.');
      if (b.assetId) {
        const a = await owned('assets', String(b.assetId), user.id);
        if (!a || a.meta?.kind !== 'avatar' || a.meta.status !== 'READY') return fail(400, 'That presenter is not ready yet.');
        if (!sc.narration) return fail(400, 'A presenter scene needs narration to speak.');
        sc.avatar_id = a.meta.rw_id; sc.avatar_name = a.name; sc.ref_asset = null; sc.ref_name = null;
      } else { sc.avatar_id = null; sc.avatar_name = null; sc.has_audio = false; }
      if (sc.clip_url) sc.status = 'stale'; sc.approved = false;
      return save({ plan });
    }
    case 'rename': return save({ title: clean(b.title, 120) || p.title, folder: clean(b.folder ?? p.folder, 60) });
    case 'scene': { // manual scene edit (Professional Studio)
      if (!plan) return fail(400, 'No scenes yet.');
      if (!tier.proStudio) return fail(402, 'Manual scene controls are part of Professional Studio. Ask the director to make the change, or upgrade.', { needsPlan: true });
      const sc = plan.scenes.find(s => s.id === b.sceneId); if (!sc) return fail(404, 'Scene not found.');
      const check = policyCheck(String(b.fields?.visual || '')); if (!check.ok) return fail(422, check.reason!);
      const before = JSON.stringify([sc.visual, sc.camera, sc.lighting, sc.seconds]);
      for (const k of ['title', 'visual', 'camera', 'lighting', 'narration', 'onscreen', 'sound', 'music'] as const) if (typeof b.fields?.[k] === 'string') (sc as any)[k] = clean(b.fields[k], 800);
      if (Number.isFinite(+b.fields?.seconds)) sc.seconds = Math.max(3, Math.min(10, Math.round(+b.fields.seconds)));
      if (before !== JSON.stringify([sc.visual, sc.camera, sc.lighting, sc.seconds]) && sc.clip_url) sc.status = 'stale';
      if (typeof b.fields?.narration === 'string') sc.voice_url = null;
      sc.approved = false;
      return save({ plan, versions: snapshot(p, `Edited scene ${sc.n}`) });
    }
    case 'approve': { if (!plan) return fail(400, 'No scenes yet.'); const sc = plan.scenes.find(s => s.id === b.sceneId); if (sc) sc.approved = !!b.on; return save({ plan }); }
    case 'reorder': {
      if (!plan || !Array.isArray(b.ids)) return fail(400, 'Nothing to reorder.');
      const next = b.ids.map((id: string) => plan.scenes.find(s => s.id === id)).filter(Boolean);
      if (next.length !== plan.scenes.length) return fail(400, 'Scene list did not match.');
      plan.scenes = next.map((s: any, i: number) => ({ ...s, n: i + 1 }));
      return save({ plan, versions: snapshot(p, 'Reordered scenes') });
    }
    case 'removeScene': {
      if (!plan || plan.scenes.length <= 2) return fail(400, 'A production needs at least two scenes.');
      plan.scenes = plan.scenes.filter(s => s.id !== b.sceneId).map((s, i) => ({ ...s, n: i + 1 }));
      return save({ plan, versions: snapshot(p, 'Removed a scene') });
    }
    case 'restore': { // Project Recovery
      const v = (p.versions || [])[+b.index]; if (!v) return fail(404, 'That version is no longer available.');
      return save({ plan: v.plan, versions: snapshot(p, 'Before restore') });
    }
    case 'aspect': { // Smart Reformat: a new version in another shape; the original stays as it is
      if (!ASPECTS.some(a => a.id === b.aspect)) return fail(400, 'Unknown format.');
      const np = await copy({ aspect: b.aspect, title: `${p.title} (${b.aspect})`, plan: plan ? stripRenders(plan) : null, status: plan ? 'planned' : 'concept' });
      return ok({ created: np.id });
    }
    case 'duplicate': { const np = await copy({ title: `${p.title} (copy)`, plan: plan ? stripRenders(plan) : null, status: plan ? 'planned' : 'concept' }); return ok({ created: np.id }); }
    case 'altEnding': { // Director's Cut: second version with a different ending
      if (!plan) return fail(400, 'No scenes yet.');
      const pl = stripRenders(plan), last = pl.scenes[pl.scenes.length - 1];
      pl.scenes = plan.scenes.map((s, i) => (i === plan.scenes.length - 1 ? { ...last, visual: `An unexpected reversal: ${last.visual.charAt(0).toLowerCase()}${last.visual.slice(1)} The final image reframes everything that came before.`, narration: 'But that is not how this story ends.' } : { ...s, approved: false }));
      const np = await copy({ title: `${p.title} (alternate ending)`, plan: pl, status: 'planned', counted: false });
      return ok({ created: np.id });
    }
    case 'trailer': { // Trailer Generator: hook, peak and final image
      if (!plan || plan.scenes.length < 3) return fail(400, 'Plan the production first.');
      const peak = plan.scenes.find(s => s.beat === 'Climax') || plan.scenes[Math.floor(plan.scenes.length / 2)];
      const picks = [plan.scenes[0], peak, plan.scenes[plan.scenes.length - 1]], secs = timeScenes(15, 3);
      const pl: Plan = { ...plan, title: `${plan.title}: Trailer`, scenes: picks.map((s, i) => ({ ...s, id: crypto.randomBytes(4).toString('hex'), n: i + 1, seconds: secs[i], status: 'planned', clip_url: null, voice_url: null, job_id: null, approved: false })) };
      pl.scenes[2].onscreen = 'Coming soon'; 
      const np = await copy({ title: pl.title, duration: 15, plan: pl, status: 'planned' });
      return ok({ created: np.id });
    }
    case 'series': { // Story-to-Series: next episode with the same cast, look and tone
      if (!tier.team) return fail(402, 'Story-to-Series is part of the Studio and Business memberships.', { needsPlan: true });
      const n = (p.episode || 1) + 1;
      const np = await copy({ title: `${p.title.replace(/: Episode \d+$/, '')}: Episode ${n}`, episode: n, prompt: `${p.prompt} Episode ${n}: continue the story with the same characters, look and tone, opening where the last episode ended.`, plan: null, chosen: null, status: 'concept' });
      return ok({ created: np.id });
    }
    case 'share': {
      const slug = p.share_slug || crypto.randomBytes(9).toString('base64url');
      return save({ shared: !!b.on, share_slug: slug });
    }
    default: return fail(400, 'Unknown action.');
  }
}, { member: true });

// Rendering workflow: charge credits per scene, submit to the video provider,
// poll for results, refund failures. Only scenes that need work are rendered.
import { db, Row, admin, now, audit } from './store';
import { isDemo } from './config';
import { spendCredits, addCredits, membership } from './auth';
import { sceneCost } from './plans';
import { Plan, Scene, scenePrompt, Brief } from './director';
import { videoLive, videoSubmit, videoStatus, voiceLive, voiceSubmit } from './providers';

export async function briefOf(project: Row): Promise<Brief> {
  const cast = project.cast_ids?.length ? (await db.list('characters', { user_id: project.user_id })).filter(c => project.cast_ids.includes(c.id)).map(c => ({ name: c.name, look: [c.appearance, c.wardrobe].filter(Boolean).join(', '), voice: c.voice })) : [];
  const [brand] = project.use_brand ? await db.list('assets', { user_id: project.user_id, role: 'brand' }, { limit: 1 }) : [];
  return { prompt: project.prompt, style: project.style, duration: project.duration, aspect: project.aspect, category: project.category, cast, brand: brand?.note || undefined };
}

export function snapshot(project: Row, label: string) {
  const versions = [...(project.versions || []), { at: now(), label, plan: project.plan }];
  return versions.slice(-15);
}

async function saveRender(path: string, data: ArrayBuffer | Buffer, type: string): Promise<string | null> {
  if (isDemo) return null;
  try {
    const { error } = await admin().storage.from('renders').upload(path, data, { contentType: type, upsert: true });
    if (error) return null;
    return admin().storage.from('renders').getPublicUrl(path).data.publicUrl;
  } catch { return null; }
}

export async function produce(user: Row, project: Row, sceneIds?: string[]) {
  const plan: Plan = project.plan, m = membership(user);
  if (!plan?.scenes?.length) return { error: 'Choose a creative direction first.', status: 400 };
  if (!project.counted) {
    if (user.videos_used >= (m.plan?.videos || 0)) return { error: `You have used all ${m.plan?.videos} productions in this month’s ${m.plan?.name} membership. Upgrade or wait for your next month.`, status: 402 };
    await db.update('profiles', user.id, { videos_used: user.videos_used + 1 });
  }
  if (!videoLive()) {
    // No video provider connected: the deliverable is the storyboard animatic. Nothing is charged.
    const p = await db.update('projects', project.id, { status: 'animatic', counted: true, updated_at: now() });
    return { project: p, mode: 'animatic', charged: 0 };
  }
  const brief = await briefOf(project), useVoice = voiceLive();
  const targets = plan.scenes.filter(s => (sceneIds?.length ? sceneIds.includes(s.id) : s.status !== 'ready') && s.status !== 'rendering');
  let charged = 0; const problems: string[] = [];
  for (const sc of targets) {
    const cost = sceneCost(sc.seconds, useVoice && !!sc.narration && !sc.voice_url);
    if (!(await spendCredits(user, cost, `Render scene ${sc.n}`, { project: project.id, scene: sc.id }))) { problems.push(`Not enough credits for scene ${sc.n} (${cost} needed).`); break; }
    const r = await videoSubmit(scenePrompt(plan, sc, brief), project.aspect, sc.seconds);
    if (r.error || !r.id) { await addCredits(user.id, cost, `Refund: scene ${sc.n} was not accepted`, { project: project.id }); sc.status = 'failed'; sc.error = r.error || 'Not accepted'; problems.push(`Scene ${sc.n}: ${sc.error}`); continue; }
    Object.assign(sc, { status: 'rendering', job_id: r.id, error: null, cost });
    charged += cost;
  }
  const p = await db.update('projects', project.id, { plan, status: 'in_production', counted: true, updated_at: now() });
  await audit(user.id, 'produce', { project: project.id, scenes: targets.length, charged });
  return { project: p, mode: 'render', charged, problems };
}

export async function poll(project: Row) {
  const plan: Plan = project.plan; if (!plan?.scenes) return project;
  let dirty = false, voiced = 0;
  for (const sc of plan.scenes as (Scene & { cost?: number })[]) {
    if (sc.status === 'rendering' && sc.job_id) {
      const st = await videoStatus(sc.job_id);
      if (st.state === 'done' && st.url) {
        // Provider URLs expire, so keep our own copy when storage allows.
        let url = st.url;
        try { const r = await fetch(st.url); if (r.ok) url = (await saveRender(`${project.id}/${sc.id}-${Date.now()}.mp4`, await r.arrayBuffer(), 'video/mp4')) || st.url; } catch { /* keep provider URL */ }
        Object.assign(sc, { status: 'ready', clip_url: url, job_id: null }); dirty = true;
      } else if (st.state === 'failed') {
        if (sc.cost) await addCredits(project.user_id, sc.cost, `Refund: scene ${sc.n} failed to render`, { project: project.id });
        Object.assign(sc, { status: 'failed', error: st.error, job_id: null, cost: 0 }); dirty = true;
      }
    }
    // Narration is its own task: submit once, then collect the audio when it is ready.
    const vs = sc as any;
    if (voiceLive() && sc.narration && !sc.voice_url && project.status !== 'concept' && project.status !== 'planned') {
      if (vs.voice_job) {
        const st = await videoStatus(vs.voice_job);
        if (st.state === 'done' && st.url) {
          let url = st.url;
          try { const r = await fetch(st.url); if (r.ok) url = (await saveRender(`${project.id}/${sc.id}-voice-${Date.now()}.mp3`, await r.arrayBuffer(), 'audio/mpeg')) || st.url; } catch { /* keep provider URL */ }
          sc.voice_url = url; vs.voice_job = null; dirty = true;
        } else if (st.state === 'failed') { vs.voice_job = null; vs.voice_failed = true; dirty = true; }
      } else if (!vs.voice_failed && voiced < 3) {
        voiced++;
        const r = await voiceSubmit(sc.narration, (plan as any).voice_preset);
        if (r.id) { vs.voice_job = r.id; dirty = true; } else { vs.voice_failed = true; dirty = true; }
      }
    }
  }
  if (!dirty) return project;
  const working = plan.scenes.some(s => s.status === 'rendering');
  const allReady = plan.scenes.every(s => s.status === 'ready');
  return (await db.update('projects', project.id, { plan, status: allReady ? 'ready' : working ? 'in_production' : project.status, updated_at: now() })) || project;
}

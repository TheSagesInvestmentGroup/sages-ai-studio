// The production brain: Creative Director (three treatments), Story Architect
// (scene plan), and the conversational editor. Uses a language provider when
// one is connected and a built-in rule-based writer otherwise, so the studio
// always works. Pure functions here have no I/O and are unit tested.
import { llmJSON } from './providers';
import { sceneCost } from './plans';

export interface Scene {
  id: string; n: number; beat: string; title: string; seconds: number;
  visual: string; camera: string; lighting: string; narration: string; onscreen: string;
  sound: string; music: string;
  status: 'planned' | 'rendering' | 'ready' | 'failed' | 'stale';
  clip_url?: string | null; voice_url?: string | null; job_id?: string | null; error?: string | null;
  approved?: boolean; lower_third?: string;
}
export interface Treatment { key: string; name: string; pitch: string; tone: string; look: string; sound: string; hook: string }
export interface Plan {
  title: string; logline: string; tone: string; look: string; audience: string; setting?: string;
  arc: { beginning: string; middle: string; climax: string; resolution: string };
  music_direction: string; voice: string; cta: string; master_prompt: string;
  cast: string[]; notes: string[]; scenes: Scene[];
}
export interface Brief { prompt: string; style: string; duration: number; aspect: string; category?: string; interests?: string[]; cast?: { name: string; look: string; voice?: string }[]; brand?: string }

const sid = () => Math.random().toString(36).slice(2, 10);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const trimDot = (s: string) => s.trim().replace(/[.!\s]+$/, '');

/** Content rules applied before any generation. */
export function policyCheck(text: string): { ok: boolean; reason?: string } {
  const t = text.toLowerCase();
  if (/(child|minor|underage|teen)[^.]{0,40}(nude|sexual|explicit|porn)|(nude|sexual|explicit|porn)[^.]{0,40}(child|minor|underage|teen)/.test(t)) return { ok: false, reason: 'We do not produce sexual content involving minors.' };
  if (/\b(deepfake|impersonate|pretend to be)\b[^.]{0,60}\b(president|senator|celebrity|ceo|my (ex|boss|neighbor))/.test(t)) return { ok: false, reason: 'We do not create realistic depictions of real people without their recorded consent.' };
  if (/\b(how to (make|build) (a )?(bomb|explosive|bioweapon)|recruit(ing)? for (isis|terror))/.test(t)) return { ok: false, reason: 'This request falls outside our content rules.' };
  return { ok: true };
}

export function subjectOf(prompt: string) {
  return trimDot(prompt.replace(/^\s*(please\s+)?(create|make|produce|generate|give me|i want|i need|build)\s+(me\s+)?(a|an|the)?\s*(short\s+)?(video|movie|film|clip|commercial|ad|animation|cartoon|documentary|trailer|reel)?\s*(of|about|for|showing|where|in which|that shows)?\s*/i, '')) || trimDot(prompt);
}

export function sceneCount(duration: number) { return duration <= 15 ? 3 : duration <= 30 ? 5 : duration <= 60 ? 8 : duration <= 90 ? 10 : duration <= 140 ? 14 : 18; }

/** Split a running time into scene lengths between 3 and 10 seconds (provider clip limits). */
export function timeScenes(duration: number, count: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => (i === 0 ? 0.8 : i === count - 1 ? 1.1 : i === count - 2 ? 1.25 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const secs = weights.map(w => Math.max(3, Math.min(10, Math.round((duration * w) / total))));
  let diff = Math.min(duration, count * 10) - secs.reduce((a, b) => a + b, 0), i = 0, guard = 0;
  while (diff !== 0 && guard++ < 500) {
    const k = i++ % count, step = diff > 0 ? 1 : -1;
    if (secs[k] + step >= 3 && secs[k] + step <= 10) { secs[k] += step; diff -= step; }
  }
  return secs;
}

/** A scene must last long enough to say its narration (about 2.5 words a second, clips run 3 to 10 seconds). */
export const secondsToSay = (text?: string | null) => { const w = (text || '').trim().split(/\s+/).filter(Boolean).length; return w ? Math.min(10, Math.ceil(w / 2.5) + 1) : 3; };
/** Lengthen any scene whose narration would otherwise be cut off. Cost follows length, so the estimate updates with it. */
export function fitScenes<T extends { seconds: number; narration?: string | null }>(scenes: T[]): T[] { for (const s of scenes) s.seconds = Math.max(s.seconds, secondsToSay(s.narration)); return scenes; }

/** "Automatic" length: sized to the kind of production and how much the idea describes, within the member's limit. */
export function autoDuration(prompt: string, category: string | undefined, cap: number): number {
  const words = prompt.trim().split(/\s+/).length, kind = (category || '') + ' ' + prompt;
  let d = /reel|teaser|trailer|commercial|advert|\bad\b|promo|product demo/i.test(kind) ? 30 : /music video|documentary|educational|short film|movie|training|musical|play/i.test(kind) ? 90 : 45;
  d += Math.floor(words / 60) * 30; // a detailed idea needs more room
  const steps = [15, 30, 60, 90, 120, 180];
  return Math.min(cap, steps.find(s => s >= d) || 180);
}

// ---------- treatments ----------
const GENRE: Record<string, { name: string; twist: string }> = {
  'Sci-Fi': { name: 'Science Fiction Adventure', twist: 'an unfolding mystery with a discovery nobody expected' },
  Fantasy: { name: 'Mythic Adventure', twist: 'a quest that tests an unlikely hero' },
  Commercial: { name: 'Brand Story', twist: 'one customer’s day made better, ending on the offer' },
  Documentary: { name: 'Human Story', twist: 'one person whose experience carries the larger truth' },
  Corporate: { name: 'Customer Story', twist: 'a real problem solved, told by the people it helped' },
  Musical: { name: 'Show-Stopper', twist: 'a number that builds from a single voice to a full company' },
};

export function builtinTreatments(b: Brief): Treatment[] {
  const s = subjectOf(b.prompt), g = GENRE[b.style] || { name: 'Story Adventure', twist: 'a character with something at stake and a turn in the final moments' };
  return [
    { key: 'A', name: 'Cinematic Epic', pitch: `${cap(s)}, staged on the largest canvas: sweeping establishing shots, a slow reveal, and a final image built to be remembered.`, tone: 'Grand, awe-inspiring, emotional', look: 'Golden-hour light, deep contrast, anamorphic wide shots, rich color grade', sound: 'Full orchestral score that swells into the finale', hook: 'Open on a single striking image before the title appears.' },
    { key: 'B', name: 'Immersive Realism', pitch: `${cap(s)}, shown as if a camera crew were really there: natural light, believable detail, and the small moments that make it feel true.`, tone: 'Grounded, intimate, observational', look: 'Natural light, handheld and documentary framing, true-to-life color', sound: 'Ambient location sound with a restrained piano and strings bed', hook: 'Open mid-action on a close detail, then pull back.' },
    { key: 'C', name: g.name, pitch: `${cap(s)} becomes the setting for ${g.twist}.`, tone: 'Suspenseful, character-driven, surprising', look: 'Dramatic low-key lighting, motivated color accents, purposeful camera moves', sound: 'Pulsing, suspenseful score with designed sound effects', hook: 'Open on a question the ending answers.' },
  ];
}

export async function treatments(b: Brief): Promise<{ list: Treatment[]; source: string }> {
  const j = await llmJSON(
    'You are the Creative Director of a premium film studio. Given a customer idea, write exactly three distinct creative treatments that enhance it without changing what the customer asked for. Keys: treatments[] with key (A,B,C), name (2-4 words), pitch (1-2 sentences), tone, look (lighting, color, camera), sound (music and sound design), hook (first 1-3 seconds).',
    JSON.stringify({ idea: b.prompt, style: b.style, seconds: b.duration, category: b.category, member_interests: b.interests }));
  const list = Array.isArray(j?.treatments) ? j.treatments.filter((t: any) => t?.name && t?.pitch).slice(0, 3) : [];
  if (list.length === 3) return { list: list.map((t: any, i: number) => ({ key: 'ABC'[i], name: String(t.name), pitch: String(t.pitch), tone: String(t.tone || ''), look: String(t.look || ''), sound: String(t.sound || ''), hook: String(t.hook || '') })), source: 'ai' };
  return { list: builtinTreatments(b), source: 'builtin' };
}

// ---------- plan ----------
const BEATS: Record<number, string[]> = {
  3: ['Hook', 'Heart', 'Finale'],
  5: ['Hook', 'World', 'Turn', 'Climax', 'Finale'],
  8: ['Hook', 'World', 'Character', 'Rising', 'Turn', 'Climax', 'Resolution', 'Finale'],
  10: ['Hook', 'World', 'Character', 'Desire', 'Rising', 'Obstacle', 'Turn', 'Climax', 'Resolution', 'Finale'],
  14: ['Hook', 'World', 'Character', 'Desire', 'First step', 'Rising', 'Ally', 'Obstacle', 'Setback', 'Turn', 'Climax', 'Aftermath', 'Resolution', 'Finale'],
};
function beatsFor(count: number): string[] {
  if (BEATS[count]) return BEATS[count];
  const b = [...BEATS[14]];
  const extra = ['Rising', 'Obstacle', 'Ally', 'Setback'];
  for (let i = 0; b.length < count; i++) b.splice(6 + i * 2, 0, extra[i % extra.length]);
  return b.slice(0, count - 1).concat('Finale');
}
const BEAT: Record<string, { v: string; cam: string; narr: string }> = {
  Hook: { v: 'A single arresting image of {s}, held just long enough to raise a question', cam: 'Slow push-in from a wide frame', narr: 'Some things you have to see to believe.' },
  World: { v: 'The wider world of {s} revealed in layers of depth and detail', cam: 'Sweeping aerial move with parallax', narr: 'This is where it begins.' },
  Character: { v: 'We meet {c}, framed against {s}, a small human detail in the foreground', cam: 'Medium close-up, shallow depth of field', narr: '{C} has been waiting for this moment.' },
  Heart: { v: 'The defining moment of {s}, full of motion and feeling', cam: 'Tracking shot that follows the action', narr: 'And then, everything comes alive.' },
  Desire: { v: '{C} looks toward what they want most, the goal visible but out of reach', cam: 'Over-the-shoulder shot racking focus to the distance', narr: 'What they want is close enough to touch.' },
  'First step': { v: '{C} commits, crossing a threshold into the unknown', cam: 'Low-angle tracking shot', narr: 'The first step is always the hardest.' },
  Rising: { v: 'Momentum builds across {s}; the pace quickens and the stakes become clear', cam: 'Dynamic tracking with quick cuts', narr: 'The pace is rising. There is no turning back.' },
  Ally: { v: 'An unexpected ally appears beside {c}', cam: 'Two-shot, gentle handheld', narr: 'Nobody does this alone.' },
  Obstacle: { v: 'A sudden obstacle stands between {c} and the goal', cam: 'Whip pan into a tight frame', narr: 'Then, the moment that tests everything.' },
  Setback: { v: '{C} alone after a setback, the world quiet around them', cam: 'Static wide shot, small figure in a large frame', narr: 'For a moment, it all seems lost.' },
  Turn: { v: 'A discovery changes the meaning of everything we have seen in {s}', cam: 'Slow dolly-in to a revealing detail', narr: 'But look closer.' },
  Climax: { v: 'The peak of the story: {s} at full scale, light, motion and emotion together', cam: 'Soaring crane move, widest frame of the film', narr: 'This is the moment it was all leading to.' },
  Aftermath: { v: 'The dust settles; small details show what has changed', cam: 'Gentle floating close-ups', narr: 'When it is over, the quiet says the most.' },
  Resolution: { v: '{C} in a changed world, calm after the peak', cam: 'Slow pull-back', narr: 'Nothing looks quite the same again.' },
  Finale: { v: 'A final, lasting image of {s} as the title and closing line appear', cam: 'Slow pull-back to a wide hero frame', narr: '{cta}' },
};

export function builtinPlan(b: Brief, t: Treatment | null): Plan {
  const s = subjectOf(b.prompt), count = sceneCount(b.duration), secs = timeScenes(b.duration, count), beats = beatsFor(count);
  const c = b.cast?.[0]?.name || 'our lead', look = t?.look || `${b.style} look with polished composition and professional color grade`;
  const isAd = /commercial|corporate/i.test(b.style + ' ' + (b.category || ''));
  const cta = isAd ? 'See it for yourself today.' : 'Imagine it. Create it. Bring it to life.';
  const fill = (x: string) => x.replace(/\{s\}/g, s).replace(/\{c\}/g, c).replace(/\{C\}/g, cap(c)).replace(/\{cta\}/g, cta);
  const music = t?.sound || 'Cinematic score matched to the emotional arc';
  const scenes: Scene[] = beats.map((beat, i) => ({
    id: sid(), n: i + 1, beat, title: beat === 'Hook' ? 'Opening hook' : beat === 'Finale' ? 'Final image' : beat,
    seconds: secs[i], visual: fill(BEAT[beat].v) + '.', camera: BEAT[beat].cam, lighting: look,
    narration: fill(BEAT[beat].narr), onscreen: beat === 'Finale' ? cta : '',
    sound: beat === 'Climax' ? 'Full impact: layered effects and score at peak' : beat === 'Hook' ? 'Near silence, then a single rising tone' : 'Ambient atmosphere matched to the setting',
    music: i === 0 ? 'Score enters softly' : i >= count - 2 ? 'Score resolves on the main theme' : 'Score builds', status: 'planned',
  }));
  const plan: Plan = {
    title: cap(s).split(/\s+/).slice(0, 7).join(' '), logline: t ? t.pitch : cap(s) + '.', tone: t?.tone || `${b.style}, faithful to the original idea`, look,
    audience: b.category || 'General audience', arc: { beginning: fill(BEAT[beats[0]].v), middle: fill(BEAT[beats[Math.floor(count / 2)]].v), climax: fill(BEAT.Climax?.v || BEAT.Heart.v), resolution: fill(BEAT.Finale.v) },
    music_direction: music, voice: 'Warm, confident narrator', cta, master_prompt: '', cast: (b.cast || []).map(x => x.name), notes: [], scenes,
  };
  plan.master_prompt = masterPrompt(plan, b);
  return plan;
}

export function masterPrompt(p: Plan, b: Brief) {
  return `${b.style} production, ${b.duration} seconds, ${b.aspect}. ${p.logline} Tone: ${p.tone}. Look: ${p.look}.${p.setting ? ` Setting: ${p.setting}.` : ''}${b.cast?.length ? ` Cast: ${b.cast.map(c => `${c.name} (${c.look})`).join('; ')}.` : ''}${b.brand ? ` Brand: ${b.brand}.` : ''} Music: ${p.music_direction}.`;
}

/** The text sent to the video model for one scene. Character and brand memory are restated in every scene for continuity. */
export function scenePrompt(p: Plan, sc: Scene, b: Brief) {
  const cast = b.cast?.length ? ` Characters: ${b.cast.map(c => `${c.name}: ${c.look}`).join('; ')}.` : '';
  return `${sc.visual} Camera: ${sc.camera}. Lighting and look: ${sc.lighting}.${p.setting ? ` Setting: ${p.setting}.` : ''}${cast}${b.brand ? ` Brand style: ${b.brand}.` : ''} Style: ${b.style}. No on-screen text.`.replace(/\s+/g, ' ');
}

export async function buildPlan(b: Brief, t: Treatment | null): Promise<{ plan: Plan; source: string }> {
  const base = builtinPlan(b, t);
  const j = await llmJSON(
    'You are a screenwriter and cinematographer. Write a production plan as JSON with: title, logline, tone, audience, arc{beginning,middle,climax,resolution}, music_direction, voice, cta, scenes[]. Each scene: title, visual (one vivid sentence for a video model), camera, lighting, narration (spoken line sized to the scene seconds, about 2.3 words per second), onscreen (short on-screen text or empty), sound, music. Keep the customer idea intact. Never invent facts about real people.',
    JSON.stringify({ idea: b.prompt, style: b.style, treatment: t, scene_seconds: base.scenes.map(s => s.seconds), cast: b.cast, brand: b.brand }));
  if (j && Array.isArray(j.scenes) && j.scenes.length >= 2) {
    const scenes = base.scenes.map((s, i) => { const x = j.scenes[i]; return x ? { ...s, title: String(x.title || s.title), visual: String(x.visual || s.visual), camera: String(x.camera || s.camera), lighting: String(x.lighting || s.lighting), narration: String(x.narration ?? s.narration), onscreen: String(x.onscreen ?? ''), sound: String(x.sound || s.sound), music: String(x.music || s.music) } : s; });
    const plan: Plan = { ...base, title: String(j.title || base.title), logline: String(j.logline || base.logline), tone: String(j.tone || base.tone), audience: String(j.audience || base.audience), arc: { ...base.arc, ...(j.arc || {}) }, music_direction: String(j.music_direction || base.music_direction), voice: String(j.voice || base.voice), cta: String(j.cta || base.cta), scenes };
    fitScenes(plan.scenes); // the writer's lines decide the final scene lengths
    plan.master_prompt = masterPrompt(plan, b);
    return { plan, source: 'ai' };
  }
  return { plan: base, source: 'builtin' };
}

// ---------- conversational editing ----------
export interface EditResult { plan: Plan; changed: string[]; reply: string; retimed?: number }
const VISUAL_FIELDS: (keyof Scene)[] = ['visual', 'camera', 'lighting', 'seconds'];

/** Mark only scenes whose picture changed as needing a new render. */
function settle(before: Plan, after: Plan): string[] {
  const changed: string[] = [];
  for (const sc of after.scenes) {
    const old = before.scenes.find(o => o.id === sc.id);
    if (!old) { changed.push(sc.id); continue; }
    const any = (Object.keys(sc) as (keyof Scene)[]).some(k => !['status', 'clip_url', 'voice_url', 'job_id', 'error', 'approved'].includes(k) && sc[k] !== old[k]);
    if (!any) continue;
    changed.push(sc.id);
    if (VISUAL_FIELDS.some(k => sc[k] !== old[k]) && sc.clip_url) sc.status = 'stale';
    if (sc.narration !== old.narration) sc.voice_url = null;
    sc.approved = false;
  }
  return changed;
}

export function builtinEdit(plan: Plan, instruction: string, sceneId?: string | null): EditResult {
  const p: Plan = structuredClone(plan), t = instruction.toLowerCase().trim(), last = p.scenes[p.scenes.length - 1];
  const targets = sceneId ? p.scenes.filter(s => s.id === sceneId) : p.scenes;
  const everywhere = /every scene|all scenes|whole (video|film|movie)|throughout/.test(t);
  let reply = '', m: RegExpMatchArray | null;

  if ((m = t.match(/(\d+)[- ]?(second|sec|s)\b/)) && /turn|make|cut|shorten|convert|version/.test(t)) {
    const d = Math.max(9, Math.min(180, +m[1])), count = sceneCount(d), keep = p.scenes.length > count ? [...p.scenes.slice(0, count - 1), last] : p.scenes;
    const secs = timeScenes(d, keep.length);
    p.scenes = keep.map((s, i) => ({ ...s, n: i + 1, seconds: secs[i] }));
    reply = `Recut to ${d} seconds across ${p.scenes.length} scenes. Scenes whose length changed need a new render; the rest are untouched.`;
    return { plan: p, changed: settle(plan, p), reply, retimed: d };
  }
  if (/more (dramatic|suspenseful|intense|tense)|add (drama|suspense|tension)/.test(t)) {
    targets.forEach(s => { s.lighting = 'Low-key, high-contrast lighting with deep shadows'; s.camera = /push-in/.test(s.camera) ? s.camera : `${s.camera}, with a slow push-in`; s.music = 'Rising tension: low strings and a heartbeat pulse'; });
    reply = `Raised the drama in ${sceneId ? 'that scene' : 'every scene'}: darker lighting, a slow push-in and rising tension in the score.`;
  } else if (/happ(y|ier)|uplifting|hopeful/.test(t) && /end/.test(t)) {
    last.visual = `${trimDot(last.visual)}, bathed in warm light as the moment turns joyful.`; last.narration = 'And this time, it ends exactly as it should.'; last.music = 'Score lifts into a bright, major-key resolution';
    reply = 'Rewrote the ending to land on a warmer, happier note. Only the final scene changed.';
  } else if (/shorten|trim|cut down/.test(t) && /(intro|opening|beginning|first)/.test(t)) {
    p.scenes[0].seconds = Math.max(3, Math.ceil(p.scenes[0].seconds / 2)); reply = `Shortened the opening to ${p.scenes[0].seconds} seconds.`;
  } else if (/(extend|lengthen|longer)/.test(t) && /(end|final|last)/.test(t)) {
    last.seconds = Math.min(10, last.seconds + 3); reply = `Extended the final scene to ${last.seconds} seconds.`;
  } else if ((m = instruction.match(/(?:change|move|set|switch)[^.]*?(?:setting|location|place|it|story)?\s*(?:to|in)\s+(.+)$/i)) && /setting|location|set (it|the)|keep the story/.test(t)) {
    p.setting = trimDot(m[1]); p.scenes.forEach(s => { s.visual = `${trimDot(s.visual.replace(/ Setting:.*$/, ''))}. Setting: ${p.setting}.`; });
    reply = `Moved the story to ${p.setting} and kept the plot, characters and dialogue as approved.`;
  } else if (/narrat|voice/.test(t)) {
    p.voice = /emotional/.test(t) ? 'Emotional, heartfelt narrator' : /female|woman/.test(t) ? 'Warm female narrator' : /male|man\b/.test(t) ? 'Deep male narrator' : /conversational/.test(t) ? 'Relaxed, conversational narrator' : `Narrator: ${trimDot(instruction)}`;
    p.scenes.forEach(s => { s.voice_url = null; });
    reply = `Narration direction is now “${p.voice}”. Picture is unchanged, so no scenes need a new render.`;
    return { plan: p, changed: [], reply };
  } else if (/music|soundtrack|score/.test(t)) {
    p.music_direction = cap(trimDot(instruction.replace(/^(add|use|change (the )?(music|soundtrack|score) to|make the (music|soundtrack|score))\s*/i, '')));
    reply = `Music direction updated to “${p.music_direction}”. Picture is unchanged.`;
    return { plan: p, changed: [], reply };
  } else if ((m = instruction.match(/^add\s+(?:an?\s+|some\s+)?(.+)$/i))) {
    if (!sceneId && !everywhere) return { plan, changed: [], reply: `Which scene should get “${trimDot(m[1])}”? Select a scene, or say “in every scene”.` };
    const what = trimDot(m[1].replace(/\s*(in|to) (every|all) scenes?|throughout/i, ''));
    (everywhere ? p.scenes : targets).forEach(s => { s.visual = `${trimDot(s.visual)}, with ${what}.`; });
    reply = `Added ${what} to ${everywhere ? 'every scene' : 'the selected scene'}.`;
  } else if (/cartoon|anime|animated/.test(t)) {
    p.look = 'Stylised animation with bold shapes and expressive motion'; p.scenes.forEach(s => { s.lighting = p.look; });
    reply = 'Converted the look to stylised animation. Every scene needs a new render because the picture changes throughout.';
  } else {
    if (!sceneId) { p.notes.push(trimDot(instruction)); return { plan: p, changed: [], reply: 'Saved as a director’s note for the whole production. To change the picture, select a scene and tell me what to change in it.' }; }
    targets.forEach(s => { s.visual = `${trimDot(s.visual)}. Direction: ${trimDot(instruction)}.`; });
    reply = 'Applied your direction to the selected scene.';
  }
  return { plan: p, changed: settle(plan, p), reply };
}

export async function applyEdit(plan: Plan, instruction: string, sceneId?: string | null): Promise<EditResult & { source: string }> {
  const compact = plan.scenes.map(s => ({ id: s.id, n: s.n, title: s.title, seconds: s.seconds, visual: s.visual, camera: s.camera, lighting: s.lighting, narration: s.narration, onscreen: s.onscreen, sound: s.sound, music: s.music }));
  const j = await llmJSON(
    'You are a film director editing an approved production plan from a spoken instruction. Change only what the instruction requires and preserve every other approved element. Return JSON: reply (one or two sentences telling the customer what changed), plan (optional object with any of: tone, look, setting, music_direction, voice, cta), scenes (array of ONLY the scenes you changed, each with id and the changed fields among title, seconds(3-10), visual, camera, lighting, narration, onscreen, sound, music). If the instruction is unclear, change nothing and ask one question in reply.',
    JSON.stringify({ instruction, selected_scene_id: sceneId || null, plan: { title: plan.title, tone: plan.tone, look: plan.look, setting: plan.setting, music_direction: plan.music_direction, voice: plan.voice }, scenes: compact }));
  if (j && typeof j.reply === 'string') {
    const p: Plan = structuredClone(plan);
    for (const k of ['tone', 'look', 'setting', 'music_direction', 'voice', 'cta'] as const) if (typeof j.plan?.[k] === 'string') (p as any)[k] = j.plan[k];
    for (const x of Array.isArray(j.scenes) ? j.scenes : []) {
      const s = p.scenes.find(s => s.id === x?.id); if (!s) continue;
      for (const k of ['title', 'visual', 'camera', 'lighting', 'narration', 'onscreen', 'sound', 'music'] as const) if (typeof x[k] === 'string') (s as any)[k] = x[k];
      if (Number.isFinite(+x.seconds)) s.seconds = Math.max(3, Math.min(10, Math.round(+x.seconds)));
    }
    fitScenes(p.scenes);
    return { plan: p, changed: settle(plan, p), reply: j.reply, source: 'ai' };
  }
  return { ...builtinEdit(plan, instruction, sceneId), source: 'builtin' };
}

export function estimate(plan: Plan, voice: boolean, onlyIds?: string[]) {
  const list = plan.scenes.filter(s => (onlyIds ? onlyIds.includes(s.id) : s.status !== 'ready' && s.status !== 'rendering'));
  return { scenes: list.length, credits: list.reduce((a, s) => a + sceneCost(s.seconds, voice && !!s.narration), 0), perScene: Object.fromEntries(plan.scenes.map(s => [s.id, sceneCost(s.seconds, voice && !!s.narration)])) };
}

// Provider adapters. Each area exposes a small interface so a vendor can be
// replaced without touching the studio. Request shapes follow the vendors'
// published API references (see docs/PROVIDERS.md for sources and dates).
import { cfg, llmProviders } from './config';

async function fetchT(url: string, init: RequestInit, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
}

// ---------- language (OpenAI-compatible chat completions, with failover) ----------
export async function llmJSON(system: string, user: string): Promise<any | null> {
  for (const p of llmProviders()) {
    try {
      const r = await fetchT(`${p.base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, temperature: 0.8, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system + '\nReply with one JSON object only.' }, { role: 'user', content: user }] }),
      }, 24000);
      if (!r.ok) { console.error('[llm]', p.name, r.status); continue; }
      const j = await r.json();
      const text: string = j?.choices?.[0]?.message?.content || '';
      return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch (e: any) { console.error('[llm]', p.name, e?.message); }
  }
  return null;
}

export async function llmText(system: string, user: string): Promise<string | null> {
  for (const p of llmProviders()) {
    try {
      const r = await fetchT(`${p.base.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, temperature: 0.5, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      }, 20000);
      if (r.ok) return (await r.json())?.choices?.[0]?.message?.content || null;
    } catch { /* try next */ }
  }
  return null;
}

// ---------- video and voice (Runway API) ----------
// One Runway Dev account serves both. Request shapes follow Runway's OpenAPI
// spec (read 12 Nov 2026): gemini_omni_flash_1.2 and kling_4 accept 1280:720 or
// 720:1280 and clips from 3 seconds; square output is reframed in the player.
export const videoLive = () => !!cfg.runwayKey;
export const voiceLive = () => !!cfg.runwayKey;
const RW = 'https://api.dev.runwayml.com';
const rwHeaders = () => ({ Authorization: `Bearer ${cfg.runwayKey}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' });

async function rwSubmit(path: string, body: any): Promise<{ id?: string; error?: string }> {
  try {
    const r = await fetchT(`${RW}${path}`, { method: 'POST', headers: rwHeaders(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) return { error: (typeof j?.error === 'string' && j.error) || j?.message || `The media service refused the request (${r.status}).` };
    return { id: j.id };
  } catch { return { error: 'The media service did not respond.' }; }
}

/** The backup video model, or null when none is set or it equals the main one. */
export const fallbackModel = () => (cfg.runwayFallbackModel && cfg.runwayFallbackModel !== 'none' && cfg.runwayFallbackModel !== cfg.runwayModel ? cfg.runwayFallbackModel : null);

export const videoSubmit = (prompt: string, aspect: string, seconds: number, model = cfg.runwayModel) =>
  rwSubmit('/v1/text_to_video', { model, promptText: prompt.slice(0, 1000), ratio: aspect === '9:16' ? '720:1280' : '1280:720', duration: Math.max(3, Math.min(10, Math.round(seconds))) });

/** Narrator: a Runway preset name, or "custom:<id>" for a member's own cloned voice. */
export const voiceSubmit = (text: string, voice?: string) =>
  rwSubmit('/v1/text_to_speech', { model: cfg.runwayVoiceModel, promptText: text.slice(0, 2000), voice: voice?.startsWith('custom:') ? { type: 'custom', id: voice.slice(7) } : { type: 'runway-preset', presetId: voice || cfg.runwayVoice } });

/** Scene that starts from a member's uploaded image. */
export const imageVideoSubmit = (prompt: string, imageUrl: string, aspect: string, seconds: number, model = cfg.runwayModel) =>
  rwSubmit('/v1/image_to_video', { model, promptImage: imageUrl, promptText: prompt.slice(0, 1000), ratio: aspect === '9:16' ? '720:1280' : '1280:720', duration: Math.max(3, Math.min(10, Math.round(seconds))) });

/** Instrumental soundtrack for a whole production. */
export const musicSubmit = (prompt: string, seconds: number) =>
  rwSubmit('/v1/text_to_music', { model: 'eleven_music_v2_5', promptText: prompt.slice(0, 2000), duration: Math.max(3, Math.min(600, Math.round(seconds))), instrumental: true });

/** Voice clone from a consented recording. Returns the Runway voice id. */
export const voiceCloneCreate = (name: string, audioUrl: string) => rwSubmit('/v1/voices', { name: name.slice(0, 100), from: { type: 'audio', audio: audioUrl } });

/** Presenter avatar from a consented photo. */
export const avatarCreate = (name: string, imageUrl: string) =>
  rwSubmit('/v1/avatars', { name: name.slice(0, 50), referenceImage: imageUrl, personality: 'A composed, credible on-camera presenter.', voice: { type: 'runway-live-preset', presetId: 'marcus' } });

/** The avatar speaks an already recorded narration file. */
export const avatarVideoSubmit = (avatarId: string, audioUrl: string) =>
  rwSubmit('/v1/avatar_videos', { model: 'gwm1_avatars', avatar: { type: 'custom', avatarId }, speech: { type: 'audio', audio: audioUrl } });

/** READY, PROCESSING or FAILED for a cloned voice ("voices") or an avatar ("avatars"). */
export async function resourceStatus(kind: 'voices' | 'avatars', id: string): Promise<'READY' | 'PROCESSING' | 'FAILED'> {
  try {
    const r = await fetchT(`${RW}/v1/${kind}/${encodeURIComponent(id)}`, { headers: rwHeaders() }, 12000);
    if (!r.ok) return 'PROCESSING';
    const s = (await r.json())?.status;
    return s === 'READY' || s === 'FAILED' ? s : 'PROCESSING';
  } catch { return 'PROCESSING'; }
}

/** Status of any Runway task (video or voice). */
export async function videoStatus(id: string): Promise<{ state: 'working' | 'done' | 'failed'; url?: string; error?: string }> {
  try {
    const r = await fetchT(`${RW}/v1/tasks/${encodeURIComponent(id)}`, { headers: rwHeaders() }, 12000);
    if (!r.ok) return { state: 'working' };
    const j = await r.json();
    if (j.status === 'SUCCEEDED' && j.output?.[0]) return { state: 'done', url: j.output[0] };
    if (j.status === 'FAILED' || j.status === 'CANCELLED') return { state: 'failed', error: j.failure || 'The media service could not complete this scene.' };
    return { state: 'working' };
  } catch { return { state: 'working' }; }
}

/** Stop a task that is no longer wanted. */
export async function taskCancel(id: string) { try { await fetchT(`${RW}/v1/tasks/${encodeURIComponent(id)}`, { method: 'DELETE', headers: rwHeaders() }, 10000); } catch { /* best effort */ } }

// ---------- social publishing (Postiz public API) ----------
const PZ = 'https://api.postiz.com/public/v1';
export const publishLive = () => !!cfg.postizKey;
// Channels that accept a text post with a link. Video-only networks need the exported file.
const TEXT_CHANNELS = ['x', 'linkedin', 'linkedin-page', 'facebook', 'threads', 'bluesky', 'mastodon', 'telegram', 'discord', 'slack'];
export interface Channel { id: string; name: string; network: string; ok: boolean }

export async function postizChannels(): Promise<{ channels?: Channel[]; error?: string }> {
  try {
    const r = await fetchT(`${PZ}/integrations`, { headers: { Authorization: cfg.postizKey } }, 12000);
    if (!r.ok) return { error: r.status === 401 || r.status === 403 ? 'Postiz did not accept the key.' : `Postiz did not respond (${r.status}).` };
    const j = await r.json();
    const list: any[] = Array.isArray(j) ? j : j?.integrations || [];
    return { channels: list.filter(i => !i.disabled).map(i => ({ id: String(i.id), name: String(i.name || i.profile || i.identifier), network: String(i.identifier), ok: TEXT_CHANNELS.includes(String(i.identifier)) })) };
  } catch { return { error: 'Postiz did not respond.' }; }
}

export async function postizPublish(channels: Channel[], content: string, at?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetchT(`${PZ}/posts`, {
      method: 'POST', headers: { Authorization: cfg.postizKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: at ? 'schedule' : 'now', date: at || new Date().toISOString(), shortLink: false, tags: [], posts: channels.map(c => ({ integration: { id: c.id }, value: [{ content, image: [] }], settings: { __type: c.network } })) }),
    }, 20000);
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, error: r.status === 429 ? 'Postiz is busy. Try again in a few minutes.' : (typeof j?.message === 'string' && j.message) || `Postiz refused the post (${r.status}).` };
  } catch { return { ok: false, error: 'Postiz did not respond.' }; }
}

// ---------- email (Resend) ----------
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!cfg.resendKey || !to) return false;
  try {
    const r = await fetchT('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${cfg.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.emailFrom, to: [to], subject, text }),
    }, 10000);
    return r.ok;
  } catch { return false; }
}

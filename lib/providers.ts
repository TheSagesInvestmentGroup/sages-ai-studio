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

export const videoSubmit = (prompt: string, aspect: string, seconds: number) =>
  rwSubmit('/v1/text_to_video', { model: cfg.runwayModel, promptText: prompt.slice(0, 1000), ratio: aspect === '9:16' ? '720:1280' : '1280:720', duration: Math.max(3, Math.min(10, Math.round(seconds))) });

export const voiceSubmit = (text: string) =>
  rwSubmit('/v1/text_to_speech', { model: cfg.runwayVoiceModel, promptText: text.slice(0, 2000), voice: { type: 'runway-preset', presetId: cfg.runwayVoice } });

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

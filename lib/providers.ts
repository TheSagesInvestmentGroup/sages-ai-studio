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

// ---------- video (Runway API) ----------
// The Runway API fronts several models; gen4.5 accepts 1280:720 or 720:1280 and
// 2–10 second clips. Square output is produced by reframing in the player.
export const videoLive = () => !!cfg.runwayKey;
const RW = 'https://api.dev.runwayml.com';
const rwHeaders = () => ({ Authorization: `Bearer ${cfg.runwayKey}`, 'X-Runway-Version': '2024-11-06', 'Content-Type': 'application/json' });

export async function videoSubmit(prompt: string, aspect: string, seconds: number): Promise<{ id?: string; error?: string }> {
  try {
    const r = await fetchT(`${RW}/v1/text_to_video`, {
      method: 'POST', headers: rwHeaders(),
      body: JSON.stringify({ model: cfg.runwayModel, promptText: prompt.slice(0, 1000), ratio: aspect === '9:16' ? '720:1280' : '1280:720', duration: Math.max(2, Math.min(10, Math.round(seconds))) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) return { error: j?.error || j?.message || `The video service refused the request (${r.status}).` };
    return { id: j.id };
  } catch { return { error: 'The video service did not respond.' }; }
}

export async function videoStatus(id: string): Promise<{ state: 'working' | 'done' | 'failed'; url?: string; error?: string }> {
  try {
    const r = await fetchT(`${RW}/v1/tasks/${encodeURIComponent(id)}`, { headers: rwHeaders() }, 12000);
    if (!r.ok) return { state: 'working' };
    const j = await r.json();
    if (j.status === 'SUCCEEDED' && j.output?.[0]) return { state: 'done', url: j.output[0] };
    if (j.status === 'FAILED' || j.status === 'CANCELLED') return { state: 'failed', error: j.failure || 'The video service could not render this scene.' };
    return { state: 'working' };
  } catch { return { state: 'working' }; }
}

// ---------- voice (ElevenLabs text to speech) ----------
export const voiceLive = () => !!(cfg.elevenKey && cfg.elevenVoice);
export async function voiceRender(text: string): Promise<Buffer | null> {
  if (!voiceLive() || !text.trim()) return null;
  try {
    const r = await fetchT(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.elevenVoice}`, {
      method: 'POST', headers: { 'xi-api-key': cfg.elevenKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: text.slice(0, 2500), model_id: cfg.elevenModel }),
    }, 20000);
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch { return null; }
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

// Subtitle file (SRT) for a production: one caption per narrated scene, timed
// from the scene lengths, with long lines split into readable cues.
const stamp = (t: number) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

function chunks(text: string, max = 84): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.trim().split(/\s+/)) { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w; }
  if (line) out.push(line);
  return out;
}

export function toSrt(scenes: { seconds: number; narration?: string | null }[]): string {
  const cues: string[] = []; let at = 0;
  for (const sc of scenes) {
    const parts = sc.narration?.trim() ? chunks(sc.narration) : [];
    const total = parts.reduce((a, p) => a + p.length, 0) || 1; let t = at;
    for (const p of parts) { const d = sc.seconds * (p.length / total); cues.push(`${cues.length + 1}\n${stamp(t)} --> ${stamp(t + d)}\n${p}\n`); t += d; }
    at += sc.seconds;
  }
  return cues.join('\n');
}

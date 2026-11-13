// Personal Bio, Résumé & Career Storytelling Studio.
// Rule: never invent employment, credentials or achievements. Everything in a
// script comes from facts the member has reviewed and approved.
import { llmJSON } from './providers';
import type { Plan, Scene } from './director';

export interface Role { title: string; company: string; dates: string; highlights: string[] }
export interface Facts { name: string; headline: string; summary: string; roles: Role[]; education: string[]; credentials: string[]; skills: string[] }

const HEADS: Record<string, RegExp> = {
  experience: /^(professional |work |relevant )?(experience|employment|career history|work history)\b/i,
  education: /^(education|academic)/i,
  credentials: /^(certifications?|licen[sc]es?|credentials|awards|honou?rs)/i,
  skills: /^(skills|core competenc|technical skills|areas of expertise)/i,
  summary: /^(summary|profile|professional summary|objective|about)/i,
};
const DATE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}|present|current|now)/i;

/** Heuristic résumé reader. It only reorganises text that is on the page. */
export function parseResume(text: string): Facts {
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const f: Facts = { name: '', headline: '', summary: '', roles: [], education: [], credentials: [], skills: [] };
  if (!lines.length) return f;
  f.name = /^[A-Za-zÀ-ÿ.'\- ]{3,50}$/.test(lines[0]) && !Object.values(HEADS).some(r => r.test(lines[0])) ? lines[0] : '';
  let section = 'top', role: Role | null = null;
  for (const line of lines.slice(f.name ? 1 : 0)) {
    const head = Object.entries(HEADS).find(([, r]) => r.test(line) && line.length < 40);
    if (head) { section = head[0]; role = null; continue; }
    const bullet = line.replace(/^[•\-–*·▪■●]\s*/, '');
    if (section === 'top') { if (!/@|\d{3}[-.\s]\d{3}|linkedin|http/i.test(line) && !f.headline && line.length < 90) f.headline = line; continue; }
    if (section === 'summary') { f.summary = (f.summary + ' ' + line).trim().slice(0, 600); continue; }
    if (section === 'education') { f.education.push(bullet); continue; }
    if (section === 'credentials') { f.credentials.push(bullet); continue; }
    if (section === 'skills') { f.skills.push(...bullet.split(/[,;|•]/).map(s => s.trim()).filter(s => s && s.length < 40)); continue; }
    if (section === 'experience') {
      const d = line.match(DATE);
      if (d) {
        const rest = line.replace(d[0], '').replace(/[|,–—\-()\s]+$/g, '').replace(/^[|,–—\-()\s]+/g, '').trim();
        const parts = rest.split(/\s+(?:at|@)\s+|\s*[|,–—]\s*/).map(s => s.trim()).filter(Boolean);
        role = { title: parts[0] || role?.title || '', company: parts[1] || '', dates: d[0], highlights: [] };
        if (!parts[0] && f.roles.length && !f.roles[f.roles.length - 1].dates) { role = f.roles[f.roles.length - 1]; role.dates = d[0]; continue; }
        f.roles.push(role);
      } else if (role && (line !== bullet || line.length > 60)) role.highlights.push(bullet);
      else if (role && !role.company && line.length < 60) role.company = line;
      else { role = { title: line, company: '', dates: '', highlights: [] }; f.roles.push(role); }
    }
  }
  f.skills = [...new Set(f.skills)].slice(0, 20);
  return f;
}

/** Section headings sometimes get read as list items ("Education", "Certifications:"). They are not facts. */
const LABEL = /^(education|academic background|certifications?|licen[sc]es?|credentials|awards|honou?rs|skills|training)(\s*(and|&|,)\s*(certifications?|licen[sc]es?|credentials|awards|honou?rs|training))*\s*:?$/i;
export const realItems = (list: string[]) => list.map(x => x.trim()).filter(x => x && !LABEL.test(x));

const key = (r: Role) => `${r.title} ${r.company}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Keep whatever the plain reader found that the AI reader left out: whole positions, or bullets within one. */
export function mergeFacts(ai: Facts, base: Facts): Facts {
  const roles = ai.roles.map(r => ({ ...r, highlights: [...r.highlights] }));
  for (const b of base.roles) {
    if (!b.title && !b.company) continue;
    const m = roles.find(r => (b.dates && r.dates && r.dates.replace(/\s/g, '') === b.dates.replace(/\s/g, '')) || (key(r) && (key(r).includes(key(b)) || key(b).includes(key(r)))));
    if (!m) { if (b.dates) roles.push(b); continue; } // only add a missing position when the plain reader is sure it is one (it has dates)
    if (b.highlights.length > m.highlights.length) m.highlights = b.highlights;
  }
  const edu = realItems(ai.education), baseEdu = realItems(base.education), cred = realItems(ai.credentials), baseCred = realItems(base.credentials);
  return { ...ai, roles: roles.slice(0, 20), education: edu.length >= baseEdu.length ? edu : baseEdu, credentials: cred.length >= baseCred.length ? cred : baseCred };
}

export async function extractFacts(text: string): Promise<{ facts: Facts; source: string }> {
  const base = parseResume(text);
  const j = await llmJSON(
    'Extract career facts from the document. Use ONLY information present in the text. Never invent or embellish employers, titles, dates, degrees, certifications or achievements. Be complete: include EVERY position in the document, however old, and for each position EVERY bullet or sentence describing it, copied in full and not summarised, merged or shortened. Include every degree and every certification, licence and award. JSON: name, headline, summary, roles[{title, company, dates, highlights[]}] (most recent first), education[], credentials[], skills[].',
    text.slice(0, 20000), 50000);
  if (j && Array.isArray(j.roles)) {
    const S = (v: any) => (typeof v === 'string' ? v : ''), A = (v: any) => (Array.isArray(v) ? v.map(S).filter(Boolean) : []);
    const ai: Facts = { name: S(j.name) || base.name, headline: S(j.headline), summary: S(j.summary), roles: j.roles.slice(0, 20).map((r: any) => ({ title: S(r?.title), company: S(r?.company), dates: S(r?.dates), highlights: A(r?.highlights).slice(0, 15) })), education: A(j.education), credentials: A(j.credentials), skills: A(j.skills).slice(0, 20) };
    return { facts: mergeFacts(ai, base), source: 'ai' };
  }
  return { facts: { ...base, education: realItems(base.education), credentials: realItems(base.credentials) }, source: 'builtin' };
}

// Generated environments illustrate an industry. They are never presented as the real workplace.
const ENV: [RegExp, string][] = [
  [/bank|financ|invest|wealth|trading|capital|audit|account/i, 'a sophisticated financial district office with city views'],
  [/cyber|security|infosec|soc\b/i, 'a cybersecurity operations centre with large monitoring displays'],
  [/software|engineer|developer|technology|\bit\b|data|cloud/i, 'a modern technology workspace with code on screens'],
  [/chief|director|vice president|\bvp\b|executive|board|govern|head of/i, 'an executive boardroom with a long table and warm light'],
  [/health|medical|nurse|clinic|hospital|pharma/i, 'a bright, modern healthcare facility'],
  [/teach|professor|school|universit|educat|instructor/i, 'a university lecture hall'],
  [/legal|attorney|law|counsel|compliance/i, 'a law office lined with books'],
  [/manufactur|plant|production|operations|supply/i, 'a clean, modern manufacturing floor'],
  [/real estate|property|broker/i, 'a model home and architectural drawings'],
  [/retail|hospitality|hotel|restaurant|customer/i, 'a welcoming hospitality setting'],
  [/design|creative|film|media|marketing|brand/i, 'a creative studio with mood boards and screens'],
];
export const environmentFor = (text: string) => ENV.find(([r]) => r.test(text))?.[1] || 'a polished contemporary office';

const STYLE_LOOK: Record<string, string> = {
  Executive: 'Refined, low-key lighting with deep navy and gold tones', Corporate: 'Clean, bright, even lighting with neutral tones',
  Cinematic: 'Shallow depth of field, warm key light and gentle camera movement', Conversational: 'Soft natural window light, relaxed framing',
  Storytelling: 'Warm, documentary-style light with intimate close framing',
};

export interface BioOptions { style: string; person: 'first' | 'third'; structure: 'chronological' | 'achievement' | 'biography'; seconds: number; maxScenes: number; kind: string }

/** Build the career video plan strictly from approved facts. */
export function careerPlan(f: Facts, o: BioOptions): Plan {
  const I = o.person === 'first', name = f.name || 'the presenter';
  let roles = f.roles.filter(r => r.title || r.company);
  if (o.structure !== 'achievement') roles = [...roles].reverse(); // résumés list newest first; tell the story oldest to newest
  else roles = [...roles].sort((a, b) => b.highlights.length - a.highlights.length);
  const room = Math.max(1, Math.min(o.maxScenes, Math.floor(o.seconds / 8)) - 2);
  roles = o.structure === 'achievement' ? roles.slice(0, room) : roles.slice(-room);
  const creds = realItems([...f.education, ...f.credentials]), hasCreds = creds.length > 0;
  const look = STYLE_LOOK[o.style] || STYLE_LOOK.Executive;
  const mk = (beat: string, title: string, visual: string, narration: string, lower = ''): Scene => ({ id: Math.random().toString(36).slice(2, 10), n: 0, beat, title, seconds: 6, visual, camera: beat === 'Intro' ? 'Slow push-in to a medium close-up' : 'Smooth lateral move as the background transitions', lighting: look, narration, onscreen: '', lower_third: lower, sound: 'Subtle room tone', music: 'Understated professional underscore', status: 'planned' });

  // A scene runs at most 10 seconds, about 24 spoken words. Whole sentences are added only while they fit,
  // so the narration is never cut off mid-sentence. Longer detail stays on the portfolio page.
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length, LIMIT = 24;
  const fit = (first: string, ...more: string[]) => more.filter(Boolean).reduce((t, x) => (words(t) + words(x) <= LIMIT ? `${t} ${x}` : t), first.trim());
  const scenes: Scene[] = [];
  const intro = fit(I ? `Hello, I’m ${name}.` : `Meet ${name}.`, f.headline ? `${f.headline}.` : '', f.summary ? f.summary.split(/(?<=\.)\s/)[0] : '');
  scenes.push(mk('Intro', 'Introduction', `The presenter, in professional attire, speaks to camera in ${environmentFor(f.headline + ' ' + (roles[roles.length - 1]?.title || ''))}.`, intro.trim(), [name, f.headline].filter(Boolean).join(' · ')));
  for (const r of roles) {
    const where = r.company ? ` at ${r.company}` : '', first = name.split(' ')[0];
    // Dates such as "2019 - Present": a role that is still held is spoken in the present tense.
    const [start, end] = (r.dates || '').split(/\s*[-–—]\s*|\s+to\s+/i).map(x => x.trim()), current = /present|current|now|today/i.test(end || '');
    let hi = r.highlights[0] ? r.highlights[0].replace(/\.$/, '') : '';
    if (hi && /^([A-Z][a-z]+ed|Led|Built|Grew|Ran|Won|Drove|Wrote|Oversaw|Set|Cut|Took|Made|Rebuilt|Began)\b/.test(hi)) hi = `${I ? 'I' : first} ${hi[0].toLowerCase()}${hi.slice(1)}`; // "Led a team" becomes "I led a team"
    hi = hi ? `${hi}.` : '';
    const what = r.title ? `${r.title}${where}` : '';
    const line = current
      ? fit(`Today ${I ? 'I serve' : `${first} serves`}${what ? ` as ${what}` : where}${start ? `, a role ${I ? 'I have' : `${first} has`} held since ${start}` : ''}.`, hi)
      : fit(`${start && end ? `From ${start} to ${end} ` : ''}${I ? 'I' : first} ${what ? `${start && end ? 'was' : 'served as'} ${what}` : `worked${where}`}.`, hi);
    scenes.push(mk('Role', [r.title, r.company].filter(Boolean).join(' · ') || 'Experience', `The background transitions to ${environmentFor(r.title + ' ' + r.company + ' ' + r.highlights.join(' '))} as the presenter continues. An illustrative environment, not the actual workplace.`, line, [r.title, r.company, r.dates].filter(Boolean).join(' · ')));
  }
  if (hasCreds) scenes.push(mk('Credentials', 'Education and credentials', 'Diplomas and certificates appear as elegant visual highlights beside the presenter.', (() => { const lead = `${I ? 'My' : 'Their'} credentials include`; let list = [creds[0]]; for (const c of creds.slice(1, 4)) if (words(`${lead} ${[...list, c].join('; ')}`) <= LIMIT) list.push(c); else break; return `${lead} ${list.join('; ')}.`; })(), 'Education & Credentials'));
  scenes.push(mk('Close', 'Closing', 'The presenter returns to the opening setting and closes with a confident, warm look to camera.', I ? `I’d welcome the chance to talk about how I can contribute. Thank you for your time.` : `${name.split(' ')[0]} welcomes the opportunity to connect. Thank you for watching.`, name));
  // Each scene lasts as long as its narration takes to say (about 2.5 words a second), then spare time is shared out.
  const secs = scenes.map(s => Math.max(4, Math.min(10, Math.ceil(words(s.narration) / 2.5) + 1)));
  for (let spare = Math.min(o.seconds, scenes.length * 10) - secs.reduce((a, b) => a + b, 0), i = 0, guard = 0; spare > 0 && guard++ < 400; i++) if (secs[i % secs.length] < 10) { secs[i % secs.length]++; spare--; }
  scenes.forEach((s, i) => { s.n = i + 1; s.seconds = secs[i]; });
  return {
    title: `${name} — ${o.kind}`, logline: `${o.style} ${o.kind.toLowerCase()} for ${name}, told in the ${I ? 'first' : 'third'} person from reviewed facts.`,
    tone: `${o.style}, credible, warm`, look, audience: 'Recruiters, hiring managers and business partners',
    arc: { beginning: 'Introduction', middle: 'Career progression', climax: 'Signature accomplishments', resolution: 'Invitation to connect' },
    music_direction: 'Understated, confident underscore with soft transitions', voice: I ? 'Presenter’s own authorised voice, or a standard narrator' : 'Professional third-person narrator',
    cta: 'View my portfolio', master_prompt: '', cast: [name], notes: ['All statements come from member-approved facts.'], scenes,
  };
}

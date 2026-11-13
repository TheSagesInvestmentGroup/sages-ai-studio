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

/** Build the career video plan strictly from approved facts.
 *  The script sizes itself to the person: every position gets a scene, and each accomplishment gets as many
 *  scenes as it takes to say in full, added newest position first until the chosen length is used up. */
export function careerPlan(f: Facts, o: BioOptions): Plan {
  const I = o.person === 'first', name = f.name || 'the presenter', first = name.split(' ')[0];
  const creds = realItems([...f.education, ...f.credentials]), hasCreds = creds.length > 0;
  const look = STYLE_LOOK[o.style] || STYLE_LOOK.Executive;
  const mk = (beat: string, title: string, visual: string, narration: string, lower = ''): Scene => ({ id: Math.random().toString(36).slice(2, 10), n: 0, beat, title, seconds: 6, visual, camera: beat === 'Intro' ? 'Slow push-in to a medium close-up' : 'Smooth lateral move as the background transitions', lighting: look, narration, onscreen: '', lower_third: lower, sound: 'Subtle room tone', music: 'Understated professional underscore', status: 'planned' });

  // A scene runs at most 10 seconds, about 24 spoken words. Text is only ever split, never shortened or reworded.
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length, LIMIT = 24;
  const secsFor = (t: string) => Math.max(4, Math.min(10, Math.ceil(words(t) / 2.5) + 1));
  const fit = (lead: string, ...more: string[]) => more.filter(Boolean).reduce((t, x) => (words(t) + words(x) <= LIMIT ? `${t} ${x}` : t), lead.trim());
  const pack = (units: string[]) => units.reduce<string[]>((out, u) => { const last = out[out.length - 1]; if (last && words(last) + words(u) <= LIMIT) out[out.length - 1] = `${last} ${u}`; else out.push(u); return out; }, []);
  /** One accomplishment as lines that can each be said in a single scene: by sentence, then clause, then length. */
  const ABBR = /(?:\b(?:Sr|Jr|Mr|Mrs|Ms|Dr|Inc|Co|Corp|Ltd|Dept|vs|etc|No|St|U\.S|e\.g|i\.e)|\b[A-Z])\.$/; // "Sr." does not end a sentence
  const sentences = (text: string) => text.split(/(?<=[.!?;])\s+/).filter(Boolean).reduce<string[]>((out, s) => { const last = out[out.length - 1]; if (last && ABBR.test(last)) out[out.length - 1] = `${last} ${s}`; else out.push(s); return out; }, []);
  const chunk = (text: string): string[] => pack(sentences(text).flatMap(sent => words(sent) <= LIMIT ? [sent] : pack(sent.split(/(?<=[,:])\s+/).flatMap(cl => { const w = cl.split(/\s+/); return w.length <= LIMIT ? [cl] : Array.from({ length: Math.ceil(w.length / 20) }, (_, i) => w.slice(i * 20, i * 20 + 20).join(' ')); }))));

  const intro = mk('Intro', 'Introduction', `The presenter, in professional attire, speaks to camera in ${environmentFor(f.headline + ' ' + (f.roles[0]?.title || ''))}.`, fit(I ? `Hello, I’m ${name}.` : `Meet ${name}.`, f.headline ? `${f.headline}.` : '', f.summary ? f.summary.split(/(?<=\.)\s/)[0] : ''), [name, f.headline].filter(Boolean).join(' · '));
  const credScene = hasCreds ? mk('Credentials', 'Education and credentials', 'Diplomas and certificates appear as elegant visual highlights beside the presenter.', (() => { const lead = `${I ? 'My' : 'Their'} credentials include`; let list = [creds[0]]; for (const c of creds.slice(1, 4)) if (words(`${lead} ${[...list, c].join('; ')}`) <= LIMIT) list.push(c); else break; return `${lead} ${list.join('; ')}.`; })(), 'Education & Credentials') : null;
  const close = mk('Close', 'Closing', 'The presenter returns to the opening setting and closes with a confident, warm look to camera.', I ? `I’d welcome the chance to talk about how I can contribute. Thank you for your time.` : `${first} welcomes the opportunity to connect. Thank you for watching.`, name);

  // Positions in priority order: newest first (résumés list them that way), or the most detailed first.
  let order = f.roles.filter(r => r.title || r.company);
  if (o.structure === 'achievement') order = [...order].sort((a, b) => b.highlights.length - a.highlights.length);
  const built = order.map(r => {
    const where = r.company ? ` at ${r.company}` : '', what = r.title ? `${r.title}${where}` : '';
    // Dates such as "2019 - Present": a role that is still held is spoken in the present tense.
    const [start, end] = (r.dates || '').split(/\s*[-–—]\s*|\s+to\s+/i).map(x => x.trim()), current = /present|current|now|today/i.test(end || '');
    const line = current
      ? `Today ${I ? 'I serve' : `${first} serves`}${what ? ` as ${what}` : where}${start ? `, a role ${I ? 'I have' : `${first} has`} held since ${start}` : ''}.`
      : `${start && end ? `From ${start} to ${end} ` : ''}${I ? 'I' : first} ${what ? `${start && end ? 'was' : 'served as'} ${what}` : `worked${where}`}.`;
    const points = r.highlights.map(h => h.trim()).filter(Boolean).map(h => {
      let t = /[.!?]$/.test(h) ? h : `${h}.`;
      if (/^([A-Z][a-z]+ed|Led|Built|Grew|Ran|Won|Drove|Wrote|Oversaw|Set|Cut|Took|Made|Rebuilt|Began)\b/.test(t)) t = `${I ? 'I' : first} ${t[0].toLowerCase()}${t.slice(1)}`; // "Led a team" becomes "I led a team"
      return chunk(t);
    });
    const env = environmentFor(r.title + ' ' + r.company + ' ' + r.highlights.join(' ')), lower = [r.title, r.company, r.dates].filter(Boolean).join(' · ');
    return { r, line, points, env, lower, use: false, taken: 0, merged: false };
  });

  // Spend the chosen length: the fixed scenes, then a scene per position, then accomplishments one round at a time.
  const fixed = [intro, credScene, close].filter(Boolean) as Scene[];
  let left = o.seconds - fixed.reduce((a, s) => a + secsFor(s.narration), 0), count = fixed.length;
  for (const b of built) { const c = secsFor(b.line); if (count === fixed.length || (left >= c && count < o.maxScenes)) { b.use = true; left -= c; count++; } }
  for (const b of built) if (b.use && b.points[0]?.length === 1 && words(b.line) + words(b.points[0][0]) <= LIMIT) { // a short first accomplishment shares the position's scene
    const grow = secsFor(`${b.line} ${b.points[0][0]}`) - secsFor(b.line); if (grow <= left) { b.merged = true; b.taken = 1; left -= grow; }
  }
  for (let round = 0, added = true; added; round++) {
    added = false;
    for (const b of built) {
      const i = b.merged ? round + 1 : round; if (!b.use || b.taken !== i || i >= b.points.length) continue;
      const cost = b.points[i].reduce((a, t) => a + secsFor(t), 0);
      if (cost <= left && count + b.points[i].length <= o.maxScenes) { b.taken++; left -= cost; count += b.points[i].length; added = true; }
    }
  }

  const told = built.filter(b => b.use), scenes: Scene[] = [intro];
  for (const b of o.structure === 'achievement' ? told : [...told].reverse()) { // chronological: oldest position first
    const label = [b.r.title, b.r.company].filter(Boolean).join(' · ') || 'Experience';
    scenes.push(mk('Role', label, `The background transitions to ${b.env} as the presenter continues. An illustrative environment, not the actual workplace.`, b.merged ? `${b.line} ${b.points[0][0]}` : b.line, b.lower));
    b.points.slice(b.merged ? 1 : 0, b.taken).forEach(lines => lines.forEach(t => scenes.push(mk('Achievement', `${label} · accomplishment`, `A cinematic illustration of this accomplishment, set in ${b.env}: ${t} Illustrative imagery, not the actual workplace or people.`, t, b.lower))));
  }
  if (credScene) scenes.push(credScene);
  scenes.push(close);
  scenes.forEach((s, i) => { s.n = i + 1; s.seconds = secsFor(s.narration); }); // each scene lasts as long as its line takes to say
  return {
    title: `${name} — ${o.kind}`, logline: `${o.style} ${o.kind.toLowerCase()} for ${name}, told in the ${I ? 'first' : 'third'} person from reviewed facts.`,
    tone: `${o.style}, credible, warm`, look, audience: 'Recruiters, hiring managers and business partners',
    arc: { beginning: 'Introduction', middle: 'Career progression', climax: 'Signature accomplishments', resolution: 'Invitation to connect' },
    music_direction: 'Understated, confident underscore with soft transitions', voice: I ? 'Presenter’s own authorised voice, or a standard narrator' : 'Professional third-person narrator',
    cta: 'View my portfolio', master_prompt: '', cast: [name], notes: ['All statements come from member-approved facts.'], scenes,
  };
}

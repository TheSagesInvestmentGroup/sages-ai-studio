import { toSrt } from '../lib/srt';
import { mergeFacts } from '../lib/career';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeScenes, sceneCount, builtinTreatments, builtinPlan, builtinEdit, estimate, policyCheck, subjectOf } from '../lib/director';
import { parseResume, careerPlan } from '../lib/career';
import { PLANS, sceneCost, COST, PROVIDER_COST_PER_SECOND_USD } from '../lib/plans';

const brief = { prompt: 'Create a video of a futuristic city with flying cars.', style: 'Sci-Fi', duration: 30, aspect: '16:9' };

test('scene timing adds up and respects 2-10 second clip limits', () => {
  for (const d of [15, 30, 60, 90, 180]) {
    const secs = timeScenes(d, sceneCount(d));
    assert.equal(secs.reduce((a, b) => a + b, 0), d, `total for ${d}`);
    assert.ok(secs.every(s => s >= 3 && s <= 10), `limits for ${d}`);
  }
});

test('subject is extracted from the request', () => assert.equal(subjectOf(brief.prompt), 'a futuristic city with flying cars'));

test('three distinct treatments, original idea preserved', () => {
  const t = builtinTreatments(brief);
  assert.equal(t.length, 3); assert.equal(new Set(t.map(x => x.name)).size, 3);
  assert.ok(t.every(x => x.pitch.toLowerCase().includes('futuristic city')));
});

test('plan covers the full running time', () => {
  const p = builtinPlan(brief, builtinTreatments(brief)[0]);
  assert.equal(p.scenes.length, 5); assert.equal(p.scenes.reduce((a, s) => a + s.seconds, 0), 30);
  const long = builtinPlan({ ...brief, duration: 180 }, null);
  assert.equal(long.scenes.reduce((a, s) => a + s.seconds, 0), 180);
});

test('editing one scene leaves every other scene untouched (selective regeneration)', () => {
  const p = builtinPlan(brief, null); p.scenes.forEach(s => { s.status = 'ready'; s.clip_url = 'x'; s.approved = true; });
  const r = builtinEdit(p, 'Add a sunset', p.scenes[2].id);
  assert.deepEqual(r.changed, [p.scenes[2].id]);
  assert.equal(r.plan.scenes[2].status, 'stale');
  assert.ok(r.plan.scenes.filter((_, i) => i !== 2).every(s => s.status === 'ready' && s.approved));
  assert.equal(estimate(r.plan, false).scenes, 1);
});

test('happier ending changes only the last scene; narration change re-renders nothing', () => {
  const p = builtinPlan(brief, null); p.scenes.forEach(s => { s.status = 'ready'; s.clip_url = 'x'; });
  assert.deepEqual(builtinEdit(p, 'Create a happier ending').changed, [p.scenes[4].id]);
  const v = builtinEdit(p, 'Make the narration more emotional');
  assert.equal(v.changed.length, 0); assert.ok(v.plan.scenes.every(s => s.status === 'ready'));
});

test('recut to a new length', () => {
  const r = builtinEdit(builtinPlan({ ...brief, duration: 60 }, null), 'Turn this into a 15-second commercial');
  assert.equal(r.plan.scenes.reduce((a, s) => a + s.seconds, 0), 15); assert.equal(r.retimed, 15);
});

test('an add request with no scene selected asks instead of guessing', () => {
  const p = builtinPlan(brief, null), r = builtinEdit(p, 'Add an explosion');
  assert.equal(r.changed.length, 0); assert.match(r.reply, /Which scene/);
});

test('content rules', () => {
  assert.equal(policyCheck('A sunrise over the ocean').ok, true);
  assert.equal(policyCheck('explicit scene with a minor').ok, false);
  assert.equal(policyCheck('deepfake of the president giving a speech').ok, false);
});

test('credit maths: a fully used allowance costs no more than half the membership fee', () => {
  assert.equal(sceneCost(5, true), 22);
  for (const p of PLANS) assert.ok((p.credits / COST.videoPerSecond) * PROVIDER_COST_PER_SECOND_USD <= p.price * 0.5, `${p.name} keeps a margin`);
});

const RESUME = `Jordan Ellis
Chief Risk Officer
jordan@example.com | 555-010-2000

Summary
Risk executive with twenty years across banking and cybersecurity.

Experience
Chief Risk Officer, Harbor National Bank, 2018 - Present
• Reduced operational losses by 31 percent over three years
• Built the bank's first cyber risk committee
VP Technology Risk | Northwind Financial | 2011 – 2018
- Led a team of 40 across three regions

Education
MBA, University of Chicago
Certifications
CISSP
CRISC`;

test('résumé parser reorganises without inventing', () => {
  const f = parseResume(RESUME);
  assert.equal(f.name, 'Jordan Ellis'); assert.equal(f.headline, 'Chief Risk Officer');
  assert.equal(f.roles.length, 2); assert.equal(f.roles[0].company, 'Harbor National Bank'); assert.equal(f.roles[0].highlights.length, 2);
  assert.equal(f.roles[1].title, 'VP Technology Risk');
  assert.deepEqual(f.credentials, ['CISSP', 'CRISC']); assert.deepEqual(f.education, ['MBA, University of Chicago']);
});

test('career script uses only approved facts', () => {
  const f = parseResume(RESUME), p = careerPlan(f, { style: 'Executive', person: 'first', structure: 'chronological', seconds: 60, maxScenes: 5, kind: 'Video résumé' });
  for (const s of p.scenes) { assert.ok(s.seconds >= 4 && s.seconds <= 10); assert.ok(s.narration.split(/\s+/).length <= s.seconds * 2.6 + 1, `scene ${s.n} narration must fit its ${s.seconds} seconds`); }
  assert.ok(p.scenes.reduce((a, s) => a + s.seconds, 0) >= Math.min(60, p.scenes.length * 10) - 1, 'spare time is shared out');
  const said = p.scenes.map(s => s.narration).join(' ');
  assert.match(said, /Harbor National Bank/); assert.match(said, /Northwind Financial/); assert.match(said, /CISSP/);
  const known = RESUME + ' Hello I’m I’d welcome the chance to talk about how can contribute Thank you for your time As at from to Today From serve role have held since was My credentials include';
  for (const w of said.match(/\b[A-Z][a-z]{3,}\b/g) || []) assert.ok(known.includes(w), `"${w}" must come from the résumé or the fixed template`);
  assert.ok(p.scenes.indexOf(p.scenes.find(s => /Northwind/.test(s.narration))!) < p.scenes.indexOf(p.scenes.find(s => /Harbor/.test(s.narration))!), 'chronological: oldest role first');
});

test('subtitle file times captions from scene lengths', () => {
  const srt = toSrt([{ seconds: 4, narration: 'First line.' }, { seconds: 3, narration: '' }, { seconds: 5, narration: 'Third scene speaks here.' }]);
  assert.equal(srt, '1\n00:00:00,000 --> 00:00:04,000\nFirst line.\n\n2\n00:00:07,000 --> 00:00:12,000\nThird scene speaks here.\n');
  const long = toSrt([{ seconds: 10, narration: 'word '.repeat(40) }]);
  assert.equal(long.split('\n\n').length, 3); assert.match(long, /--> 00:00:10,000/);
});

test('résumé merge keeps positions and bullets the AI reader dropped', () => {
  const base = parseResume(RESUME);
  const ai = { ...base, roles: [{ ...base.roles[0], highlights: base.roles[0].highlights.slice(0, 1) }] };
  const m = mergeFacts(ai, base);
  assert.equal(m.roles.length, 2); assert.equal(m.roles[0].highlights.length, 2); assert.equal(m.roles[1].company, 'Northwind Financial');
  assert.equal(mergeFacts(base, base).roles.length, 2, 'nothing is duplicated when both readers agree');
});

test('career narration fits its scene and skips section headings', () => {
  const long = 'Enterprise function lead responsible for the design, build-out and continuous monitoring of a control framework spanning forty-two business units, three regulators and a programme of quarterly attestations.';
  const f = { name: 'Sam Rivera', headline: 'Senior Data Risk Executive', summary: 'With over 25 years of experience within the financial services industry across risk, data, privacy, compliance, audit and regulatory reporting disciplines at five national banks.', roles: [{ title: 'Lead Control Officer', company: 'First Bank', dates: 'November 2019 – September 2023', highlights: [long] }], education: ['Education', 'State University, BS Finance'], credentials: ['Certifications:', 'CISA'], skills: [] };
  const p = careerPlan(f, { style: 'Executive', person: 'first', structure: 'chronological', seconds: 60, maxScenes: 7, kind: 'Video résumé' });
  for (const s of p.scenes) assert.ok(s.narration.split(/\s+/).length <= 24, `"${s.narration}" is too long to say in one scene`);
  const role = p.scenes.find(s => s.beat === 'Role')!; assert.equal(role.narration, 'From November 2019 to September 2023 I was Lead Control Officer at First Bank.');
  const cred = p.scenes.find(s => s.beat === 'Credentials')!; assert.equal(cred.narration, 'My credentials include State University, BS Finance; CISA.');
});

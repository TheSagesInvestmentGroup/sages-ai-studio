'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { STYLES, DURATIONS, ASPECTS, CATEGORIES } from '@/lib/plans';
import { useMe, NeedPlan } from '@/components/useMe';

const SPARKS: Record<string, string> = {
  Action: 'A motorcycle courier races a storm across a neon city to deliver a package that must not get wet.', Romance: 'Two strangers keep missing each other by seconds on the same train platform, until the day the train is late.',
  'Sci-Fi': 'The last lighthouse keeper on Mars notices the beam has started blinking back.', 'Spy & Thriller': 'A translator realises the two diplomats she is interpreting for are secretly saying the same thing.',
  Historical: 'A scribe in ancient Alexandria hides one scroll the night before the library burns.', Documentary: 'A day in the life of a city bakery, from the first oven at 3 a.m. to the last loaf sold.',
  Business: 'A 30-second commercial for a neighbourhood coffee roaster that knows every customer by name.', Finance: 'An explainer showing how one dollar saved at twenty grows by sixty, told as a journey through time.',
  Sports: 'The final ten seconds of a championship game, seen entirely from the bench.', Travel: 'Sunrise to sunset on the Amalfi Coast, told through one traveller’s sketchbook.',
  Wellness: 'A calm one-minute morning routine film set in a sunlit mountain cabin.', 'Cartoons & Animation': 'A shy cloud learns to make rain in time to save the village garden.',
  Fantasy: 'A mapmaker discovers her newest map is drawing itself.', Spirituality: 'A meditation on stillness: a single candle in a vast stone hall as dawn arrives.',
  'Musicals & Theatre': 'An opening number where the night-shift staff of a grand hotel sing the building awake.', Commercials: 'A product launch film for a watch that is revealed one reflection at a time.',
};

export default function Studio() {
  const { me } = useMe();
  const [prompt, setPrompt] = useState(''), [style, setStyle] = useState('Cinematic'), [duration, setDuration] = useState(30), [aspect, setAspect] = useState('16:9'), [category, setCategory] = useState(''), [mode, setMode] = useState<'quick' | 'pro'>('quick');
  const [cast, setCast] = useState<any[]>([]), [castIds, setCastIds] = useState<string[]>([]), [recent, setRecent] = useState<any[]>([]), [busy, setBusy] = useState(''), [err, setErr] = useState<any>(null);
  useEffect(() => { api('/api/projects').then(r => setRecent(r.projects.slice(0, 4))).catch(() => {}); api('/api/characters').then(r => setCast(r.characters)).catch(() => {}); }, []);
  const maxSeconds = me?.plan?.maxSeconds || 60;

  async function create(magic: boolean) {
    setBusy(magic ? 'magic' : 'enhance'); setErr(null);
    try { const r = await api('/api/projects', 'POST', { prompt, style, duration, aspect, category, mode, castIds, magic }); location.href = `/studio/projects/${r.project.id}`; }
    catch (e: any) { setErr(e); setBusy(''); }
  }
  function surprise() {
    const pool = (me?.user.interests || []).map((i: string) => SPARKS[i]).filter(Boolean); const all = pool.length ? pool : Object.values(SPARKS);
    setPrompt(all[Math.floor(Math.random() * all.length)]);
  }

  return (
    <div className="stack-lg">
      <section className="create">
        <div className="row between">
          <div><h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)' }}>What will you create today{me ? `, ${me.user.name.split(' ')[0]}` : ''}?</h1><p className="muted">Turn your imagination into an extraordinary production.</p></div>
          <div className="row" role="group" aria-label="Studio mode"><button className={`chip ${mode === 'quick' ? 'on' : ''}`} onClick={() => setMode('quick')}>Quick Create</button><button className={`chip ${mode === 'pro' ? 'on' : ''}`} onClick={() => setMode('pro')} title="Scene-by-scene controls">Professional Studio</button></div>
        </div>
        {me && !me.member && <NeedPlan />}
        {err && (err.needsPlan ? <NeedPlan text={err.message} /> : <div className="notice bad" role="alert">{err.message}</div>)}
        <textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe your movie, video, commercial, or creative idea…" maxLength={3000} aria-label="Your idea" />
        <div className="grid g4">
          <label className="field">Style<select id="style" value={style} onChange={e => setStyle(e.target.value)}>{STYLES.map(s => <option key={s}>{s}</option>)}</select></label>
          <label className="field">Length<select id="duration" value={duration} onChange={e => setDuration(+e.target.value)}>{DURATIONS.map(d => <option key={d} value={d} disabled={d > maxSeconds}>{d < 60 ? `${d} seconds` : d === 60 ? '1 minute' : d === 90 ? '90 seconds' : '3 minutes'}{d > maxSeconds ? ' (higher tier)' : ''}</option>)}</select></label>
          <label className="field">Format<select id="aspect" value={aspect} onChange={e => setAspect(e.target.value)}>{ASPECTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
          <label className="field">Kind of production<select id="category" value={category} onChange={e => setCategory(e.target.value)}><option value="">Let the director decide</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        {mode === 'pro' && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="small muted" style={{ fontWeight: 600 }}>Cast from your character library</span>
            <div className="row">{cast.length ? cast.map(c => <button key={c.id} className={`chip ${castIds.includes(c.id) ? 'on' : ''}`} aria-pressed={castIds.includes(c.id)} onClick={() => setCastIds(x => (x.includes(c.id) ? x.filter(i => i !== c.id) : [...x, c.id]))}>{c.name}</button>) : <span className="muted small">No characters yet. <Link href="/studio/characters">Create one</Link> to keep the same face and voice across scenes.</span>}</div>
          </div>
        )}
        <div className="row">
          <button className="btn primary" id="enhance" onClick={() => create(false)} disabled={!!busy || prompt.trim().length < 8}>{busy === 'enhance' ? <><span className="spin" /> Your director is reading…</> : 'Enhance my creative idea'}</button>
          <button className="btn" id="magic" onClick={() => create(true)} disabled={!!busy || prompt.trim().length < 8} title="The director picks a treatment and plans every scene in one step">{busy === 'magic' ? <><span className="spin" /> Planning…</> : 'One-Click Movie Magic'}</button>
          <button className="btn ghost" id="surprise" onClick={surprise} disabled={!!busy}>Surprise me with an idea</button>
        </div>
        {me && !me.engines.video && <p className="small faint">Video rendering is not connected yet, so productions are delivered as narrated storyboard animatics. Planning, treatments and editing work in full.</p>}
      </section>

      <section className="grid g3">
        <Link className="tile" href="/studio/projects"><b>My Projects</b><span>Drafts, productions and versions</span></Link>
        <Link className="tile" href="/studio/characters"><b>Characters</b><span>Reusable actors with a consistent look and voice</span></Link>
        <Link className="tile" href="/studio/assets"><b>My Assets</b><span>Footage, audio, images, scripts and brand files</span></Link>
        <Link className="tile" href="/studio/bio"><b>Bio &amp; Résumé Studio</b><span>Turn a résumé into a career video and portfolio</span></Link>
        <Link className="tile" href="/studio/billing"><b>Membership &amp; Credits</b><span>{me?.member ? `${me.plan.name} · ${me.user.videos_used} of ${me.plan.videos} productions used` : 'Choose a membership'}</span></Link>
        <Link className="tile" href="/studio/support"><b>Help Center</b><span>Ask the studio assistant anything</span></Link>
      </section>

      {recent.length > 0 && (
        <section className="stack">
          <div className="row between"><h2>Recent productions</h2><Link href="/studio/projects">View all</Link></div>
          <div className="grid g4">{recent.map(p => <Link className="tile" key={p.id} href={`/studio/projects/${p.id}`}><b>{p.title}</b><span>{p.style} · {p.duration}s · {p.aspect}</span><span className={`pill ${p.status === 'ready' ? 'good' : p.status === 'in_production' ? 'info' : 'gold'}`}>{STATUS[p.status] || p.status}</span></Link>)}</div>
        </section>
      )}
    </div>
  );
}
const STATUS: Record<string, string> = { concept: 'Choose a direction', planned: 'Planned', animatic: 'Animatic ready', in_production: 'Rendering', ready: 'Ready' };

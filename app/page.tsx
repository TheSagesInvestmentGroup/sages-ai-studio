import Link from 'next/link';
import { PLANS, CATEGORIES } from '@/lib/plans';
import Player from '@/components/Player';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';
// A shared production chosen by the owner (FEATURED_SLUG) plays on the home page.
async function featured() {
  const slug = (process.env.FEATURED_SLUG || '').trim(); if (!slug) return null;
  try { const [p] = await db.list('projects', { share_slug: slug }); if (!p?.shared || !p.plan) return null;
    return { title: p.title, aspect: p.aspect, scenes: p.plan.scenes.map((s: any) => ({ id: s.id, n: s.n, beat: s.beat, title: s.title, seconds: s.seconds, visual: s.visual, camera: s.camera, narration: s.narration, onscreen: s.onscreen, clip_url: s.clip_url, voice_url: s.voice_url })) };
  } catch { return null; }
}

const CREW = [
  ['Creative Director', 'Turns a sentence into three distinct creative treatments.'], ['Screenwriter', 'Writes the script, narration and scene breakdown.'],
  ['Cinematographer', 'Chooses camera moves, framing, lighting and color.'], ['Casting Director', 'Keeps your characters consistent from scene to scene.'],
  ['Voice Director', 'Directs narration and matches it to the mood.'], ['Composer & Sound Designer', 'Writes the music and sound direction for every scene.'],
  ['Film Editor', 'Recuts on request and re-renders only what changed.'], ['Executive Producer', 'Shows the credit cost before anything is rendered.'],
];
const STEPS = [
  ['Imagine it', 'Describe your idea in a sentence, or upload a script, a photo or a clip.'], ['Enhance it', 'Your Creative Director offers three ways to tell it. Or keep your idea exactly as written.'],
  ['Create it', 'Pick a style and length. The studio plans every scene, shot, line and sound.'], ['Perfect it', 'Say what to change: “Make it more dramatic.” “Add a sunset.” Only that part is redone.'],
  ['Publish it', 'Export for widescreen, vertical or square, and share it to your social channels.'],
];

export default async function Home() {
  const show = await featured();
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow">AI video, film and animation studio</span>
            <h1>Imagine it. Create it. Bring it to life.</h1>
            <p className="muted" style={{ fontSize: '1.08rem' }}>You bring the imagination. The Sages AI Studio brings the production company: a director, a screenwriter, a cinematographer, an editor and a sound team, working from a single sentence.</p>
            <div className="row"><Link className="btn primary" href="/signup">Become a member</Link><Link className="btn" href="/pricing">See memberships from $10</Link></div>
          </div>
        </div>
      </section>

      <section className="wrap" aria-label="The Sages AI Studio in pictures" style={{ paddingTop: 28 }}>
        <div className="gallery">
          {[['studio-1-brand', 'The Sages AI Studio. Create, innovate, empower.'], ['studio-2-intelligence', 'Intelligence that inspires.'], ['studio-3-powerhouse', 'Your personal AI powerhouse.'], ['studio-4-ideas', 'Dream, plan, achieve.'], ['studio-5-tomorrow', 'A smarter, more empowered tomorrow.']].map(([f, alt]) => <img key={f} src={`/brand/${f}.jpg`} alt={alt} loading="lazy" width={630} height={1022} />)}
        </div>
      </section>

      {show && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="wrap stack" style={{ maxWidth: 940 }}>
            <div className="stack"><span className="eyebrow">Made in the studio</span><h2>From one sentence to this</h2></div>
            <Player scenes={show.scenes} aspect={show.aspect} title={show.title} />
          </div>
        </section>
      )}

      <section className="section" id="how">
        <div className="wrap stack-lg">
          <div className="stack" style={{ maxWidth: 640 }}><span className="eyebrow">Five steps</span><h2>From a sentence to a finished production</h2></div>
          <div className="grid g4 steps">{STEPS.map(([t, d]) => <div className="step stack" key={t} style={{ gap: 6 }}><h3>{t}</h3><p className="muted small">{d}</p></div>)}</div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--stage)', borderBlock: '1px solid var(--line-soft)' }}>
        <div className="wrap grid g2" style={{ alignItems: 'center', gap: 36 }}>
          <img src="/studio-control.jpg" alt="A production control room with editors working at a wall of screens" style={{ borderRadius: 16, border: '1px solid var(--line)' }} width={1400} height={799} />
          <div className="stack-lg">
            <div className="stack"><span className="eyebrow">Your crew</span><h2>A full production team behind one prompt</h2><p className="muted">You never have to learn editing software. Each specialist works behind the scenes and answers to you.</p></div>
            <div className="grid g2" style={{ gap: 18 }}>{CREW.map(([t, d]) => <div key={t}><h3 style={{ fontSize: '1rem' }}>{t}</h3><p className="muted small">{d}</p></div>)}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap stack-lg">
          <div className="stack" style={{ maxWidth: 640 }}><span className="eyebrow">What members make</span><h2>Every kind of production, one studio</h2></div>
          <div className="row">{CATEGORIES.map(c => <span className="chip" key={c} style={{ cursor: 'default' }}>{c}</span>)}<span className="chip on" style={{ cursor: 'default' }}>Video résumé and career story</span></div>
          <div className="panel grid g2" style={{ alignItems: 'center' }}>
            <div className="stack"><h3>Bio &amp; Résumé Studio</h3><p className="muted">Upload a résumé and get a narrated career video with a shareable portfolio page and QR code. Every statement comes from facts you review and approve. Nothing is invented.</p></div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><Link className="btn" href="/pricing">Included from $10 a month</Link></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--stage)', borderTop: '1px solid var(--line-soft)' }}>
        <div className="wrap stack-lg">
          <div className="stack center" style={{ alignItems: 'center' }}><span className="eyebrow">Membership</span><h2>Choose your studio</h2><p className="muted">Billed monthly. Change or cancel any time.</p></div>
          <div className="grid g4">{PLANS.map(p => <div className="panel plan" key={p.id}><h3>{p.name}</h3><div className="price">${p.price}<small> / month</small></div><p className="muted small">{p.videos} productions a month</p></div>)}</div>
          <div className="center"><Link className="btn primary" href="/pricing">Compare memberships</Link></div>
        </div>
      </section>

      <footer className="site"><div className="wrap row between"><span>© {new Date().getFullYear()} The Sages Investment Group. AI-generated media is labelled as synthetic.</span><span className="row"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></span></div></footer>
    </main>
  );
}

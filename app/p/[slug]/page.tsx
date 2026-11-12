import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import Player from '@/components/Player';
import { db } from '@/lib/store';
import { cfg } from '@/lib/config';

export const dynamic = 'force-dynamic';
async function find(slug: string) { if (!/^[\w-]{8,40}$/.test(slug)) return null; const [p] = await db.list('projects', { share_slug: slug }); return p?.shared && p.plan ? p : null; }

export async function generateMetadata({ params }: { params: { slug: string } }) { const p = await find(params.slug); return p ? { title: p.title, description: p.plan.logline, robots: { index: false } } : { title: 'Not found' }; }

export default async function Shared({ params }: { params: { slug: string } }) {
  const p = await find(params.slug); if (!p) notFound();
  const url = `${cfg.siteUrl}/p/${p.share_slug}`, f = p.portfolio?.facts;
  const qr = p.kind === 'bio' ? await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#090c16', light: '#ffffff' } }) : '';
  const files = p.portfolio?.attachments?.length ? (await db.list('assets', { user_id: p.user_id })).filter(a => p.portfolio.attachments.includes(a.id) && a.ready && a.visibility !== 'private') : [];
  const photo = p.portfolio?.avatar ? await db.get('assets', p.portfolio.avatar) : null;
  // Viewers get only what is needed to play: no prompts, job ids or account data.
  const scenes = p.plan.scenes.map((s: any) => ({ id: s.id, n: s.n, beat: s.beat, title: s.title, seconds: s.seconds, visual: s.visual, camera: s.camera, narration: s.narration, onscreen: s.onscreen, lower_third: s.lower_third, clip_url: s.clip_url, voice_url: s.voice_url }));
  return (
    <main className="wrap section stack-lg" style={{ maxWidth: 940 }}>
      <div className="stack"><span className="eyebrow">{p.kind === 'bio' ? 'Career portfolio' : 'A Sages AI Studio production'}</span><h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.6rem)' }}>{p.title}</h1><p className="muted">{p.plan.logline}</p></div>
      <Player scenes={scenes} aspect={p.aspect} title={p.title} />
      <p className="small faint">This video was created with AI. {p.kind === 'bio' ? 'Backgrounds are illustrative and do not show actual workplaces. Career details were provided and approved by the person presented.' : ''}</p>
      {p.kind === 'bio' && f && (
        <div className="work">
          <div className="stack">
            <h2>Career timeline</h2>
            {f.roles.map((r: any, i: number) => <div className="panel tight stack" key={i} style={{ gap: 4 }}><div className="row between"><b>{r.title}</b><span className="muted small">{r.dates}</span></div><span className="gold small">{r.company}</span>{r.highlights.length > 0 && <ul className="ticks">{r.highlights.map((h: string) => <li key={h}>{h}</li>)}</ul>}</div>)}
            {(f.education.length > 0 || f.credentials.length > 0) && <div className="panel tight stack"><h3>Education and credentials</h3><ul className="ticks">{[...f.education, ...f.credentials].map((e: string) => <li key={e}>{e}</li>)}</ul></div>}
          </div>
          <aside className="stack">
            <div className="panel stack">{photo?.visibility !== 'private' && photo?.ready && <img src={`/api/assets/${photo.id}?p=${p.share_slug}`} alt={`Portrait of ${f.name}`} style={{ borderRadius: 12 }} />}<h3>{f.name}</h3>{f.headline && <p className="muted">{f.headline}</p>}{f.summary && <p className="small muted">{f.summary}</p>}</div>
            {files.length > 0 && <div className="panel stack"><h3>Documents</h3>{files.map(a => <a key={a.id} href={`/api/assets/${a.id}?p=${p.share_slug}`} target="_blank" rel="noreferrer">{a.name}</a>)}</div>}
            {p.portfolio.links?.length > 0 && <div className="panel stack"><h3>Links</h3>{p.portfolio.links.map((l: string) => <a key={l} href={l} target="_blank" rel="noreferrer nofollow" style={{ wordBreak: 'break-all' }}>{l.replace(/^https:\/\/(www\.)?/, '')}</a>)}</div>}
            <div className="panel stack center" style={{ alignItems: 'center' }}><div style={{ width: 150, background: '#fff', padding: 8, borderRadius: 10 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="QR code for this portfolio" role="img" /><span className="small muted">Scan to open this portfolio</span></div>
          </aside>
        </div>
      )}
    </main>
  );
}

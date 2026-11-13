'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import Player from '@/components/Player';
import { useMe, Toast, NeedPlan } from '@/components/useMe';
import { ASPECTS, VOICES } from '@/lib/plans';

const PILL: Record<string, [string, string]> = { planned: ['Planned', ''], rendering: ['Rendering', 'info'], ready: ['Rendered', 'good'], failed: ['Failed', 'bad'], stale: ['Needs new render', 'warn'] };
const IDEAS = ['Make it more dramatic', 'Create a happier ending', 'Shorten the introduction', 'Turn this into a 15-second commercial', 'Make the narration more emotional', 'Add suspenseful music'];

export default function Workspace({ params }: { params: { id: string } }) {
  const { me, refresh } = useMe();
  const [d, setD] = useState<any>(null), [err, setErr] = useState<any>(null), [busy, setBusy] = useState(''), [toast, setToast] = useState('');
  const [sel, setSel] = useState<string | null>(null), [picked, setPicked] = useState<string[]>([]), [text, setText] = useState(''), [editing, setEditing] = useState<any>(null), [confirmDel, setConfirmDel] = useState(false), [more, setMore] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  const say = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3800); };
  const p = d?.project, plan = p?.plan, scenes: any[] = plan?.scenes || [];

  const load = useCallback(() => api(`/api/projects/${params.id}`).then(setD).catch(setErr), [params.id]);
  useEffect(() => { load(); }, [load]);
  // While scenes render, check on them every 6 seconds.
  const voicing = !!d?.engines?.voice && !!p && !['concept', 'planned'].includes(p.status) && scenes.some(s => s.narration && !s.voice_url && !s.voice_failed);
  const rendering = scenes.some(s => s.status === 'rendering') || voicing;
  useEffect(() => { if (!rendering) return; const t = setInterval(() => api(`/api/projects/${params.id}/poll`).then(r => { setD((x: any) => ({ ...x, project: r.project, estimate: r.estimate })); if (!r.project.plan.scenes.some((s: any) => s.status === 'rendering')) refresh(); }).catch(() => {}), 6000); return () => clearInterval(t); }, [rendering, params.id, refresh]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [p?.chat?.length]);

  async function run(name: string, fn: () => Promise<any>, done?: string) {
    setBusy(name); setErr(null);
    try { const r = await fn(); if (r?.created) { location.href = `/studio/projects/${r.created}`; return; } if (r?.project) setD((x: any) => ({ ...x, ...r })); if (done) say(done); return r; }
    catch (e: any) { setErr(e); } finally { setBusy(''); }
  }
  const op = (body: any, done?: string) => run(body.op, () => api(`/api/projects/${params.id}`, 'PATCH', body), done);

  async function direct(instruction: string) {
    if (!instruction.trim()) return; setText('');
    const r = await run('edit', () => api(`/api/projects/${params.id}/edit`, 'POST', { instruction, sceneId: sel }));
    if (r?.rerender?.length) say(`${r.rerender.length} scene${r.rerender.length > 1 ? 's' : ''} need a new render (${r.rerenderCost} credits). The rest are untouched.`);
  }
  async function produce(sceneIds?: string[]) {
    const r = await run('produce', () => api(`/api/projects/${params.id}/produce`, 'POST', { sceneIds }));
    if (!r) return; refresh();
    say(r.mode === 'animatic' ? 'Your animatic is ready. Press Play preview.' : r.problems?.length ? r.problems[0] : `Rendering started. ${r.charged} credits used.`);
  }

  if (err && !d) return <div className="stack"><div className="notice bad">{err.message}</div><Link href="/studio/projects">Back to projects</Link></div>;
  if (!p) return <p className="muted">Opening your production…</p>;
  const est = d.estimate, todo = scenes.filter(s => s.status !== 'ready' && s.status !== 'rendering'), share = typeof location !== 'undefined' && p.share_slug ? `${location.origin}/p/${p.share_slug}` : '';
  const shareText = encodeURIComponent(`${p.title} — made with The Sages AI Studio`), u = encodeURIComponent(share);

  return (
    <div className="stack-lg">
      <div className="row between">
        <div className="stack" style={{ gap: 4 }}>
          <Link href="/studio/projects" className="small muted">← My Projects</Link>
          <h1 style={{ fontSize: 'clamp(1.5rem,3vw,2.1rem)' }}>{p.title}</h1>
          <span className="muted small">{p.style} · {p.duration}s · {p.aspect}{p.kind === 'bio' ? ' · Career story' : ''}{plan ? ` · ${scenes.length} scenes` : ''}</span>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => op({ op: 'duplicate' })} disabled={!!busy}>Duplicate</button>
          <button className="btn sm" id="more" onClick={() => setMore(m => !m)} aria-expanded={more}>More versions</button>
          {confirmDel ? <><button className="btn sm danger" id="confirm-delete" onClick={() => run('del', async () => { await api(`/api/projects/${params.id}`, 'DELETE'); location.href = '/studio/projects'; })}>Delete for good</button><button className="btn sm ghost" onClick={() => setConfirmDel(false)}>Keep</button></> : <button className="btn sm ghost danger" onClick={() => setConfirmDel(true)}>Delete</button>}
        </div>
      </div>
      {more && plan && (
        <div className="panel tight row">
          <span className="small muted">Create a new version, leaving this one as it is:</span>
          <button className="btn sm" onClick={() => op({ op: 'altEnding' })} disabled={!!busy}>Director’s Cut (alternate ending)</button>
          <button className="btn sm" onClick={() => op({ op: 'trailer' })} disabled={!!busy}>15-second trailer</button>
          {ASPECTS.filter(a => a.id !== p.aspect).map(a => <button key={a.id} className="btn sm" onClick={() => op({ op: 'aspect', aspect: a.id })} disabled={!!busy}>Reformat to {a.id}</button>)}
          <button className="btn sm" onClick={() => op({ op: 'series' })} disabled={!!busy}>Next episode</button>
        </div>
      )}
      {err && (err.needsPlan ? <NeedPlan text={err.message} /> : <div className="notice bad" role="alert">{err.message}</div>)}

      {p.status === 'concept' || !plan ? (
        <section className="stack-lg">
          <div className="panel stack"><span className="eyebrow">Your idea</span><p style={{ fontSize: '1.05rem' }}>“{p.prompt}”</p></div>
          <div className="stack"><h2>Three ways to tell it</h2><p className="muted">Pick one, tick two or more to combine them, or keep your idea exactly as you wrote it. {p.treatment_source === 'builtin' && <span className="faint">Written by the built-in director.</span>}</p></div>
          <div className="grid g3">
            {(p.treatments || []).map((t: any) => (
              <div className={`panel stack ${picked.includes(t.key) ? 'plan featured' : ''}`} key={t.key}>
                <div className="row between"><span className="eyebrow">Option {t.key}</span><label className="check small"><input type="checkbox" checked={picked.includes(t.key)} onChange={() => setPicked(x => (x.includes(t.key) ? x.filter(k => k !== t.key) : [...x, t.key]))} />Combine</label></div>
                <h3>{t.name}</h3><p className="muted">{t.pitch}</p>
                <dl className="small muted stack" style={{ gap: 6, margin: 0 }}>{[['Tone', t.tone], ['Look', t.look], ['Sound', t.sound], ['Opening', t.hook]].map(([k, v]) => v ? <div key={k}><b style={{ color: 'var(--text)' }}>{k}. </b>{v}</div> : null)}</dl>
                <div className="grow" /><button className="btn primary block" id={`choose-${t.key}`} disabled={!!busy} onClick={() => op({ op: 'choose', key: t.key }, 'Scenes planned.')}>{busy === 'choose' ? <span className="spin" /> : `Use ${t.name}`}</button>
              </div>
            ))}
          </div>
          <div className="row">
            {picked.length > 1 && <button className="btn primary" disabled={!!busy} onClick={() => op({ op: 'choose', combine: picked }, 'Scenes planned.')}>Combine options {picked.join(' + ')}</button>}
            <button className="btn" id="choose-original" disabled={!!busy} onClick={() => op({ op: 'choose', key: 'original' }, 'Scenes planned from your original idea.')}>Use my idea unchanged</button>
            <button className="btn ghost" disabled={!!busy} onClick={() => op({ op: 'choose', key: 'surprise' }, 'Scenes planned.')}>Surprise me</button>
          </div>
        </section>
      ) : (
        <section className="work">
          <div className="stack">
            <Player scenes={scenes} aspect={p.aspect} title={p.title}/>
            <div className="panel tight stack" style={{ gap: 6 }}><span className="eyebrow">Logline</span><p>{plan.logline}</p><p className="small muted"><b>Tone.</b> {plan.tone} · <b>Music.</b> {plan.music_direction} · <b>Voice.</b> {plan.voice}{plan.setting ? <> · <b>Setting.</b> {plan.setting}</> : null}</p></div>
            <div className="row between"><h2>Scenes</h2><span className="muted small">Select a scene to direct it on its own</span></div>
            <div className="stack" style={{ gap: 8 }}>
              {scenes.map((s, i) => (
                <div key={s.id} className={`scene ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(sel === s.id ? null : s.id)} role="button" tabIndex={0} aria-pressed={sel === s.id} onKeyDown={e => { if (e.key === 'Enter') setSel(sel === s.id ? null : s.id); }}>
                  <span className="n">{s.n}</span>
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row between"><b>{s.title}</b><span className="row" style={{ gap: 6 }}>{s.approved && <span className="pill good">Approved</span>}<span className={`pill ${PILL[s.status]?.[1]}`}>{PILL[s.status]?.[0]}</span><span className="pill" title="Length and credit cost to render">{s.seconds}s · {est?.perScene?.[s.id] ?? 0} cr</span></span></div>
                    <p className="small">{s.visual}</p>
                    {s.narration && <p className="small muted">“{s.narration}”</p>}
                    {s.error && <p className="small" style={{ color: 'var(--bad)' }}>{s.error} Your credits for this scene were refunded.</p>}
                    {sel === s.id && (
                      <div className="stack" style={{ gap: 8 }} onClick={e => e.stopPropagation()}>
                        <p className="small faint">Camera: {s.camera} · Light: {s.lighting} · Sound: {s.sound}</p>
                        <div className="row">
                          <button className="btn sm" onClick={() => op({ op: 'approve', sceneId: s.id, on: !s.approved })}>{s.approved ? 'Remove approval' : 'Approve scene'}</button>
                          {d.engines.video && <button className="btn sm" onClick={() => produce([s.id])} disabled={!!busy || s.status === 'rendering'}>{s.clip_url ? 'Render again' : 'Render this scene'} ({est?.perScene?.[s.id]} cr)</button>}
                          {s.clip_url && <a className="btn sm" href={s.clip_url} download target="_blank" rel="noreferrer">Download MP4</a>}
                          <button className="btn sm" onClick={() => setEditing({ ...s })}>Edit details</button>
                          {i > 0 && <button className="btn sm ghost" onClick={() => { const ids = scenes.map(x => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; op({ op: 'reorder', ids }); }}>Move up</button>}
                          {i < scenes.length - 1 && <button className="btn sm ghost" onClick={() => { const ids = scenes.map(x => x.id); [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; op({ op: 'reorder', ids }); }}>Move down</button>}
                          <button className="btn sm ghost danger" onClick={() => { setSel(null); op({ op: 'removeScene', sceneId: s.id }); }}>Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="stack">
            <div className="panel stack">
              <div className="row between"><h3>Talk to your director</h3>{sel ? <span className="pill gold">Scene {scenes.find(s => s.id === sel)?.n}</span> : <span className="pill">Whole production</span>}</div>
              <div className="chat" aria-live="polite">
                {(p.chat || []).length === 0 && <p className="small muted">Say what to change in plain words. Approved scenes you do not mention stay exactly as they are.</p>}
                {(p.chat || []).map((m: any, i: number) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
                {busy === 'edit' && <div className="msg director"><span className="spin" /></div>}
                <div ref={chatEnd} />
              </div>
              <form className="row" onSubmit={e => { e.preventDefault(); direct(text); }}>
                <input id="direction" className="grow" value={text} onChange={e => setText(e.target.value)} placeholder={sel ? 'Change this scene…' : 'Make it more suspenseful…'} maxLength={600} aria-label="Direction" />
                <button className="btn primary sm" id="send-direction" disabled={busy === 'edit' || text.trim().length < 3}>Send</button>
              </form>
              <div className="row" style={{ gap: 6 }}>{IDEAS.map(i => <button key={i} className="chip" onClick={() => direct(i)} disabled={!!busy}>{i}</button>)}</div>
            </div>

            <div className="panel stack">
              <h3>Production</h3>
              {d.engines.video ? (
                <>
                  <div className="row between"><span className="muted">{todo.length ? `${todo.length} scene${todo.length > 1 ? 's' : ''} to render` : 'Every scene is rendered'}</span><b className="gold">{est?.credits ?? 0} credits</b></div>
                  <div className="row between small muted"><span>Your balance</span><span>{me?.user.credits?.toLocaleString() ?? '…'} credits</span></div>
                  <button className="btn primary block" id="produce" onClick={() => produce()} disabled={!!busy || rendering || !todo.length}>{rendering ? <><span className="spin" /> Rendering scenes…</> : busy === 'produce' ? <span className="spin" /> : todo.length ? `Render ${todo.length} scene${todo.length > 1 ? 's' : ''}` : 'All scenes rendered'}</button>
                  <p className="small faint">Only scenes that are new or changed are rendered. Failed renders are refunded.</p>
                  <label className="field">Narrator voice<select id="narrator" value={plan.voice_preset || ''} onChange={e => e.target.value && op({ op: 'voice', preset: e.target.value }, 'Narrator changed. Recording the new narration now.')} disabled={!!busy}><option value="">Studio default</option>{VOICES.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
                  {voicing && <p className="small muted"><span className="spin" /> Recording narration…</p>}
                </>
              ) : (
                <>
                  <p className="muted small">Video rendering is not connected, so this production is delivered as a narrated storyboard animatic. No credits are charged.</p>
                  <button className="btn primary block" id="produce" onClick={() => produce()} disabled={!!busy || p.status === 'animatic'}>{p.status === 'animatic' ? 'Animatic ready' : busy === 'produce' ? <span className="spin" /> : 'Finish the animatic'}</button>
                </>
              )}
            </div>

            <div className="panel stack">
              <h3>Publish and share</h3>
              <label className="check"><input id="share-toggle" type="checkbox" checked={!!p.shared} onChange={e => op({ op: 'share', on: e.target.checked }, e.target.checked ? 'Share link is on.' : 'Share link is off.')} />Anyone with the link can watch</label>
              {p.shared && share && (
                <>
                  <div className="row"><input readOnly value={share} id="share-link" aria-label="Share link" className="grow" onFocus={e => e.target.select()} /><button className="btn sm" onClick={() => navigator.clipboard.writeText(share).then(() => say('Link copied.')).catch(() => say('Select the link and copy it.'))}>Copy</button></div>
                  <div className="row" style={{ gap: 6 }}>
                    <a className="chip" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?text=${shareText}&url=${u}`}>X</a>
                    <a className="chip" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${u}`}>Facebook</a>
                    <a className="chip" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`}>LinkedIn</a>
                    <a className="chip" target="_blank" rel="noreferrer" href={`https://www.threads.net/intent/post?text=${shareText}%20${u}`}>Threads</a>
                  </div>
                  <p className="small faint">For Instagram, TikTok and YouTube, export the video file and upload it in their apps, with this link in the caption.</p>
                </>
              )}
            </div>

            {(p.versions || []).length > 0 && (
              <div className="panel stack">
                <h3>Earlier versions</h3>
                <div className="stack" style={{ gap: 6 }}>{[...p.versions].map((v: any, i: number) => ({ v, i })).reverse().slice(0, 6).map(({ v, i }) => <div className="row between small" key={i}><span className="muted">{v.label} · {new Date(v.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><button className="btn sm ghost" onClick={() => op({ op: 'restore', index: i }, 'Version restored.')} disabled={!!busy}>Restore</button></div>)}</div>
              </div>
            )}
          </aside>
        </section>
      )}

      {editing && (
        <div className="panel stack" id="scene-editor" style={{ borderColor: 'var(--gold-deep)' }}>
          <div className="row between"><h3>Scene {editing.n} details</h3><span className="pill gold">Professional Studio</span></div>
          <div className="grid g2">
            <label className="field">Title<input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
            <label className="field">Length in seconds (3 to 10)<input type="number" min={3} max={10} value={editing.seconds} onChange={e => setEditing({ ...editing, seconds: +e.target.value })} /></label>
          </div>
          <label className="field">What we see<textarea value={editing.visual} onChange={e => setEditing({ ...editing, visual: e.target.value })} /></label>
          <div className="grid g2">
            <label className="field">Camera<input value={editing.camera} onChange={e => setEditing({ ...editing, camera: e.target.value })} /></label>
            <label className="field">Lighting and look<input value={editing.lighting} onChange={e => setEditing({ ...editing, lighting: e.target.value })} /></label>
            <label className="field">Narration<input value={editing.narration} onChange={e => setEditing({ ...editing, narration: e.target.value })} /></label>
            <label className="field">On-screen text<input value={editing.onscreen} onChange={e => setEditing({ ...editing, onscreen: e.target.value })} /></label>
            <label className="field">Sound effects<input value={editing.sound} onChange={e => setEditing({ ...editing, sound: e.target.value })} /></label>
            <label className="field">Music<input value={editing.music} onChange={e => setEditing({ ...editing, music: e.target.value })} /></label>
          </div>
          <div className="row"><button className="btn primary" disabled={!!busy} onClick={async () => { const r = await op({ op: 'scene', sceneId: editing.id, fields: editing }, 'Scene saved.'); if (r) setEditing(null); }}>Save scene</button><button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button></div>
        </div>
      )}
      <Toast text={toast} />
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { uploadAsset } from '@/lib/upload';
import { useMe, NeedPlan } from '@/components/useMe';

const STEPS = ['Career story', 'Review facts', 'Your photo', 'Presentation', 'Generate'];
const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

export default function Bio() {
  const { me } = useMe();
  const [step, setStep] = useState(0), [busy, setBusy] = useState(''), [err, setErr] = useState<any>(null);
  const [text, setText] = useState(''), [facts, setFacts] = useState<any>(null), [source, setSource] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [avatar, setAvatar] = useState<any>(null), [consent, setConsent] = useState(false), [cam, setCam] = useState(false);
  const [o, setO] = useState({ kind: 'Video résumé', style: 'Executive', person: 'first', structure: 'chronological', seconds: 60, aspect: '16:9' });
  const [creds, setCreds] = useState<any[]>([]), [attach, setAttach] = useState<string[]>([]), [links, setLinks] = useState('');
  const file = useRef<HTMLInputElement>(null), video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null);
  const cap = me?.plan?.bio;
  useEffect(() => { api('/api/assets').then(r => setCreds(r.assets.filter((a: any) => a.role === 'credential' && a.ready))).catch(() => {}); return () => stream.current?.getTracks().forEach(t => t.stop()); }, []);
  const guard = async (name: string, fn: () => Promise<void>) => { setBusy(name); setErr(null); try { await fn(); } catch (e: any) { setErr(e); } finally { setBusy(''); } };

  const extract = () => guard('Reading your career story…', async () => {
    const fd = new FormData(); if (file.current?.files?.[0]) fd.set('file', file.current.files[0]); fd.set('text', text);
    const r = await api('/api/bio/extract', 'POST', fd); setFacts(r.facts); setSource(r.source); setStep(1);
  });
  async function startCam() { // permission is requested only when the member presses the button
    setErr(null);
    try { stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280 }, audio: false }); setCam(true); setTimeout(() => { if (video.current) { video.current.srcObject = stream.current; video.current.play(); } }, 50); }
    catch { setErr({ message: 'We could not use your camera. Allow camera access in your browser, or upload a photo instead.' }); }
  }
  const snap = () => guard('Saving your photo…', async () => {
    const v = video.current!, c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d')!.drawImage(v, 0, 0);
    const blob: Blob = await new Promise(res => c.toBlob(b => res(b!), 'image/jpeg', 0.9));
    stream.current?.getTracks().forEach(t => t.stop()); setCam(false);
    setAvatar(await uploadAsset(blob, { name: 'presenter-photo.jpg', role: 'avatar', rights: true, consent: true, subject: facts?.name }));
  });
  const uploadPhoto = (f?: File) => f && guard('Saving your photo…', async () => { setAvatar(await uploadAsset(f, { name: f.name, role: 'avatar', rights: true, consent: true, subject: facts?.name })); });
  const uploadCred = (f?: File) => f && guard(`Uploading ${f.name}…`, async () => { const a = await uploadAsset(f, { name: f.name, role: 'credential', rights: true }); setCreds(c => [...c, a]); setAttach(x => [...x, a.id].slice(0, cap?.attachments || 5)); });
  const create = () => guard('Writing your script and planning scenes…', async () => {
    const r = await api('/api/bio/create', 'POST', { facts, confirmed, options: o, attachments: attach, links: lines(links), avatarId: avatar?.id });
    location.href = `/studio/projects/${r.project.id}`;
  });
  const setRole = (i: number, k: string, v: any) => setFacts((f: any) => ({ ...f, roles: f.roles.map((r: any, j: number) => (j === i ? { ...r, [k]: v } : r)) }));

  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <div className="stack"><span className="eyebrow">Bio &amp; Résumé Studio</span><h1 style={{ fontSize: '2rem' }}>Turn your career into a story worth watching</h1><p className="muted">Upload a résumé, approve the facts, and receive a narrated career video with a shareable portfolio page. Nothing is added that you did not write.</p></div>
      <ol className="row" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 6 }}>{STEPS.map((s, i) => <li key={s} className={`chip ${i === step ? 'on' : ''}`} style={{ cursor: 'default' }} aria-current={i === step ? 'step' : undefined}>{i + 1}. {s}</li>)}</ol>
      {me && !me.member && <NeedPlan />}
      {err && (err.needsPlan ? <NeedPlan text={err.message} /> : <div className="notice bad" role="alert">{err.message}</div>)}
      {busy && <p className="notice"><span className="spin" /> {busy}</p>}

      {step === 0 && (
        <div className="panel stack">
          <h3>Upload your career story</h3>
          <label className="field">Résumé, cover letter or biography (PDF, DOCX or TXT, up to 4 MB)<input id="resume-file" ref={file} type="file" accept=".pdf,.docx,.txt" /></label>
          <label className="field">Or paste the text<textarea id="resume-text" value={text} onChange={e => setText(e.target.value)} style={{ minHeight: 180 }} placeholder="Paste your résumé here" maxLength={20000} /></label>
          <div><button className="btn primary" id="extract" onClick={extract} disabled={!!busy}>Read my career story</button></div>
        </div>
      )}

      {step === 1 && facts && (
        <div className="panel stack">
          <h3>Review your facts</h3>
          <p className="muted small">This is everything the script may say. Correct anything that is wrong and remove anything you do not want mentioned. {source === 'builtin' ? 'Read by the built-in parser, so please check dates and titles carefully.' : ''}</p>
          <div className="grid g2">
            <label className="field">Name<input id="fact-name" value={facts.name} onChange={e => setFacts({ ...facts, name: e.target.value })} /></label>
            <label className="field">Headline<input value={facts.headline} onChange={e => setFacts({ ...facts, headline: e.target.value })} placeholder="Chief Risk Officer" /></label>
          </div>
          <label className="field">Summary<textarea value={facts.summary} onChange={e => setFacts({ ...facts, summary: e.target.value })} /></label>
          <span className="eyebrow">Positions</span>
          {facts.roles.map((r: any, i: number) => (
            <div className="panel tight flat stack" key={i} style={{ border: '1px solid var(--line-soft)' }}>
              <div className="grid g3"><label className="field">Title<input value={r.title} onChange={e => setRole(i, 'title', e.target.value)} /></label><label className="field">Company<input value={r.company} onChange={e => setRole(i, 'company', e.target.value)} /></label><label className="field">Dates<input value={r.dates} onChange={e => setRole(i, 'dates', e.target.value)} /></label></div>
              <label className="field">Accomplishments, one per line<textarea value={r.highlights.join('\n')} onChange={e => setRole(i, 'highlights', e.target.value.split('\n'))} style={{ minHeight: 120 }} /></label>
              <div><button className="btn sm ghost danger" onClick={() => setFacts({ ...facts, roles: facts.roles.filter((_: any, j: number) => j !== i) })}>Remove position</button></div>
            </div>
          ))}
          <div><button className="btn sm" onClick={() => setFacts({ ...facts, roles: [...facts.roles, { title: '', company: '', dates: '', highlights: [] }] })}>Add a position</button></div>
          <div className="grid g2">
            <label className="field">Education, one per line (type or paste)<textarea value={facts.education.join('\n')} onChange={e => setFacts({ ...facts, education: e.target.value.split('\n') })} style={{ minHeight: 110 }} /></label>
            <label className="field">Certifications, licenses and awards, one per line (type or paste)<textarea value={facts.credentials.join('\n')} onChange={e => setFacts({ ...facts, credentials: e.target.value.split('\n') })} style={{ minHeight: 110 }} /></label>
          </div>
          <label className="check"><input id="confirm-facts" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />These facts are accurate and I approve them for my career video.</label>
          <div className="row"><button className="btn ghost" onClick={() => setStep(0)}>Back</button><button className="btn primary" id="facts-next" disabled={!confirmed || !facts.name} onClick={() => setStep(2)}>Continue</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="panel stack">
          <h3>Your presenter photo</h3>
          <p className="muted small">Your photo appears on your portfolio page. Face a window or lamp, keep the camera at eye level, and leave space above your head. You can skip this and add one later.</p>
          <div className="notice">Animated avatars and voice replicas are not available yet. Your video uses a professional narrator, and we do not collect a voice sample until that feature can use it.</div>
          <label className="check"><input id="likeness-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />This is a photo of me and I agree to it being shown with my career video and portfolio. This consent is recorded and I can delete the photo at any time.</label>
          {avatar ? <p className="notice good">Photo saved: {avatar.name}. <button className="btn sm ghost" onClick={async () => { await api(`/api/assets/${avatar.id}`, 'DELETE'); setAvatar(null); }}>Remove</button></p> : (
            <div className="row">
              <button className="btn" onClick={startCam} disabled={!consent || cam || !!busy}>Use my camera</button>
              <label className={`btn ${consent ? '' : 'ghost'}`} style={consent ? undefined : { opacity: 0.5, pointerEvents: 'none' }}>Upload a photo<input type="file" accept=".png,.jpg,.jpeg,.webp" hidden onChange={e => uploadPhoto(e.target.files?.[0])} /></label>
            </div>
          )}
          {cam && <div className="stack"><video ref={video} muted playsInline style={{ width: '100%', maxWidth: 420, borderRadius: 12, border: '1px solid var(--line)', transform: 'scaleX(-1)' }} /><div className="row"><button className="btn primary" onClick={snap}>Take photo</button><button className="btn ghost" onClick={() => { stream.current?.getTracks().forEach(t => t.stop()); setCam(false); }}>Cancel</button></div></div>}
          <div className="row"><button className="btn ghost" onClick={() => setStep(1)}>Back</button><button className="btn primary" id="photo-next" onClick={() => setStep(3)}>{avatar ? 'Continue' : 'Skip for now'}</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="panel stack">
          <h3>Choose your presentation</h3>
          <div className="grid g3">
            <label className="field">Type<select value={o.kind} onChange={e => setO({ ...o, kind: e.target.value })}>{['Video résumé', 'Professional biography', 'Executive introduction', 'Cover letter video'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="field">Style<select value={o.style} onChange={e => setO({ ...o, style: e.target.value })}>{['Executive', 'Corporate', 'Cinematic', 'Conversational', 'Storytelling'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="field">Voice<select value={o.person} onChange={e => setO({ ...o, person: e.target.value })}><option value="first">First person (“I led…”)</option><option value="third">Third person (“She led…”)</option></select></label>
            <label className="field">Story order<select value={o.structure} onChange={e => setO({ ...o, structure: e.target.value })}><option value="chronological">Chronological career history</option><option value="achievement">Biggest achievements first</option><option value="biography">Professional biography</option></select></label>
            <label className="field">Length<select value={o.seconds} onChange={e => setO({ ...o, seconds: +e.target.value })}>{[30, 60, 120, 180].map(s => <option key={s} value={s} disabled={s > (cap?.maxSeconds || 60)}>{s < 60 ? `${s} seconds` : `${s / 60} minute${s > 60 ? 's' : ''}`}{s > (cap?.maxSeconds || 60) ? ' (higher tier)' : ''}</option>)}</select></label>
            <label className="field">Format<select value={o.aspect} onChange={e => setO({ ...o, aspect: e.target.value })}><option value="16:9">Widescreen (LinkedIn, email)</option><option value="9:16">Vertical (phone)</option></select></label>
          </div>
          <span className="eyebrow">Portfolio attachments (up to {cap?.attachments ?? 5})</span>
          <p className="muted small">Résumé, diplomas, certifications, letters and awards. Each stays private until you change its visibility in My Assets.</p>
          <div className="row">{creds.map(c => <button key={c.id} className={`chip ${attach.includes(c.id) ? 'on' : ''}`} aria-pressed={attach.includes(c.id)} onClick={() => setAttach(x => (x.includes(c.id) ? x.filter(i => i !== c.id) : [...x, c.id].slice(0, cap?.attachments || 5)))}>{c.name}</button>)}<label className="btn sm">Add a document<input type="file" hidden accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" onChange={e => uploadCred(e.target.files?.[0])} /></label></div>
          <label className="field">Links, one per line (LinkedIn, portfolio, website)<textarea value={links} onChange={e => setLinks(e.target.value)} style={{ minHeight: 70 }} placeholder="https://www.linkedin.com/in/you" /></label>
          <div className="row"><button className="btn ghost" onClick={() => setStep(2)}>Back</button><button className="btn primary" id="bio-create" onClick={create} disabled={!!busy}>Generate my career video</button></div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { INTERESTS } from '@/lib/plans';
import { api } from '@/lib/client';

export default function Onboarding() {
  const [picked, setPicked] = useState<string[]>([]), [own, setOwn] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const toggle = (i: string) => setPicked(p => (p.includes(i) ? p.filter(x => x !== i) : [...p, i]));
  async function save() {
    setBusy(true);
    try {
      await api('/api/me', 'PATCH', { interests: [...picked, ...own.split(',').map(s => s.trim()).filter(Boolean)], onboarded: true });
      const plan = new URLSearchParams(location.search).get('plan');
      location.href = plan ? '/pricing' : '/studio';
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <main className="wrap section stack-lg" style={{ maxWidth: 760 }}>
      <div className="stack"><span className="eyebrow">Welcome</span><h1>What inspires you?</h1><p className="muted">Pick as many as you like. Your Creative Director uses these to suggest ideas and shape treatments. You can change them any time.</p></div>
      {err && <div className="notice bad">{err}</div>}
      <div className="row">{INTERESTS.map(i => <button key={i} type="button" className={`chip ${picked.includes(i) ? 'on' : ''}`} aria-pressed={picked.includes(i)} onClick={() => toggle(i)}>{i}</button>)}</div>
      <label className="field">Anything else? Separate with commas<input id="own-interests" value={own} onChange={e => setOwn(e.target.value)} placeholder="Jazz, architecture, classic cars" maxLength={200} /></label>
      <div className="row"><button className="btn primary" id="finish-onboarding" onClick={save} disabled={busy}>{busy ? <span className="spin" /> : 'Enter the studio'}</button><button className="btn ghost" onClick={save} disabled={busy}>Skip for now</button></div>
    </main>
  );
}

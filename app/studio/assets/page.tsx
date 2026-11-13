'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { uploadAsset } from '@/lib/upload';
import { useMe, NeedPlan } from '@/components/useMe';

const ROLES: [string, string][] = [['reference', 'Creative reference only'], ['incorporate', 'Include in the production'], ['transform', 'Transform or enhance'], ['reusable', 'Reusable project asset'], ['brand', 'Brand asset (logo, colors, guidelines)'], ['credential', 'Career credential or attachment'], ['voice', 'My voice sample (to create my own narrator voice)'], ['avatar', 'My presenter photo (to create an on-screen presenter)']];
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Assets() {
  const { me } = useMe();
  const [list, setList] = useState<any[] | null>(null), [role, setRole] = useState('reference'), [rights, setRights] = useState(false), [consent, setConsent] = useState(false), [busy, setBusy] = useState(''), [err, setErr] = useState<any>(null), [over, setOver] = useState(false), [picked, setPicked] = useState<File[]>([]), [brand, setBrand] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const load = () => api('/api/assets').then(r => { setList(r.assets); setBrand(r.assets.find((a: any) => a.kind === 'brand')?.note || ''); }).catch(setErr);
  useEffect(() => { load(); }, []);
  // While a voice or presenter is being created, check on it every 8 seconds.
  const making = (list || []).filter(a => a.meta?.status === 'PROCESSING').map(a => a.id).join(',');
  useEffect(() => { if (!making) return; const t = setInterval(async () => { await Promise.all(making.split(',').map(id => api(`/api/assets/${id}/make`).catch(() => {}))); load(); }, 8000); return () => clearInterval(t); }, [making]);

  async function send() {
    const files = picked; if (!files.length) return; setErr(null);
    if (!rights) { setErr({ message: 'Confirm that you own these files or have permission to use them.' }); return; }
    const personal = role === 'voice' || role === 'avatar';
    if (personal && !consent) { setErr({ message: 'Tick the consent box to use your own voice or likeness.' }); return; }
    for (const file of files) {
      setBusy(`Uploading ${file.name}…`);
      try { await uploadAsset(file, { name: file.name, role, rights: true, consent: personal && consent }); } catch (e: any) { setErr(e); break; }
    }
    setBusy(''); setPicked([]); if (input.current) input.current.value = ''; load();
  }
  return (
    <div className="stack-lg">
      <div className="stack"><h1 style={{ fontSize: '2rem' }}>My Assets</h1><p className="muted" style={{ maxWidth: 680 }}>Your private library of footage, audio, images, scripts and brand files. Files are stored privately and are never used to train AI models.</p></div>
      {err && (err.needsPlan ? <NeedPlan text={err.message} /> : <div className="notice bad" role="alert">{err.message}</div>)}
      <div className="panel stack" onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); setErr(null); setPicked(Array.from(e.dataTransfer.files)); }} style={over ? { borderColor: 'var(--gold)' } : undefined}>
        <h3>Add files</h3>
        <div className="grid g2">
          <label className="field">How should the studio use these files?<select id="asset-role" value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="field">Choose files, or drop them anywhere on this panel<input id="asset-file" ref={input} type="file" multiple accept=".mp4,.mov,.webm,.mp3,.wav,.aac,.m4a,.png,.jpg,.jpeg,.webp,.pdf,.docx,.txt,.srt,.vtt" onChange={e => { setErr(null); setPicked(Array.from(e.target.files || [])); }} disabled={!!busy} /></label>
        </div>
        <label className="check"><input id="asset-rights" type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} />I own these files or have permission to use them, including any people, voices, music and logos in them.</label>
        {(role === 'voice' || role === 'avatar') && <label className="check"><input id="asset-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>{role === 'voice' ? 'This is a recording of my own voice' : 'This is a photo of me'}, or I hold the written permission of the person in it. I agree to it being used to create a synthetic {role === 'voice' ? 'voice' : 'presenter'} for my productions. This consent is recorded, and I can delete the file at any time.</span></label>}
        {role === 'voice' && <p className="small faint">Record one to two minutes of clear speech in a quiet room, with no music or other voices. MP3, WAV or M4A.</p>}
        {role === 'avatar' && <p className="small faint">Use a clear, front-facing photo with good light and a plain background. PNG, JPG or WEBP.</p>}
        {picked.length > 0 && !busy && <p className="small muted">Ready to upload: {picked.map(f => f.name).join(', ')}</p>}
        <div className="row" style={{ gap: 10, alignItems: 'center' }}><button id="asset-upload" className="btn" onClick={send} disabled={!!busy || !picked.length}>{busy ? 'Uploading…' : picked.length > 1 ? `Upload ${picked.length} files` : 'Upload file'}</button><span className="small faint">{!picked.length ? 'Step 1: choose a file. Step 2: tick the box. Step 3: press Upload.' : !rights ? 'Tick the permission box, then press Upload.' : 'Press Upload to add it to your library.'}</span></div>
        {busy && <p className="notice"><span className="spin" /> {busy}</p>}
        <p className="small faint">MP4, MOV, WEBM, MP3, WAV, AAC, PNG, JPG, WEBP, PDF, DOCX, TXT and SRT.</p>
      </div>

      {me?.plan?.brand && (
        <div className="panel stack"><h3>Brand Memory</h3><p className="muted small">Describe your brand once. It is applied to every production where you switch it on.</p>
          <textarea id="brand-note" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Colors, typography, tone of voice, logo usage, things to always or never show" maxLength={800} />
          <div><button className="btn" onClick={async () => { const old = list?.find(a => a.kind === 'brand'); try { if (old) await api(`/api/assets/${old.id}`, 'PATCH', { note: brand }); else await api('/api/assets', 'POST', { role: 'brand', note: brand }); load(); } catch (e: any) { setErr(e); } }}>Save brand profile</button></div>
        </div>
      )}

      {list === null ? <p className="muted">Loading…</p> : list.filter(a => a.kind !== 'brand').length === 0 ? <div className="panel"><h3>Nothing uploaded yet</h3><p className="muted">Files you add will be listed here with their type, how they are used and who can see them.</p></div> : (
        <div className="panel tight scroll-x"><table>
          <thead><tr><th>File</th><th>Type</th><th>Use</th><th className="num">Size</th><th>Visibility on portfolio</th><th /></tr></thead>
          <tbody>{list.filter(a => a.kind !== 'brand').map(a => (
            <tr key={a.id}><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a> : <span className="muted">{a.name} (upload unfinished)</span>}</td><td>{a.kind}</td><td>{ROLES.find(r => r[0] === a.role)?.[1] || a.role}</td><td className="num">{size(a.size)}</td>
              <td><select aria-label={`Visibility of ${a.name}`} value={a.visibility} onChange={async e => { await api(`/api/assets/${a.id}`, 'PATCH', { visibility: e.target.value }); load(); }} style={{ maxWidth: 190 }}><option value="private">Private (only you)</option><option value="link">People with your link</option><option value="public">Public</option></select></td>
              <td><div className="row" style={{ gap: 6 }}>{(a.role === 'voice' || a.role === 'avatar') && a.ready && (a.meta?.status === 'READY' ? <span className="pill good">{a.role === 'voice' ? 'Voice ready' : 'Presenter ready'}</span> : a.meta?.status === 'PROCESSING' ? <span className="pill info">Creating…</span> : <button className="btn sm" onClick={async () => { setErr(null); try { await api(`/api/assets/${a.id}/make`, 'POST'); load(); } catch (e: any) { setErr(e); } }}>{a.meta?.status === 'FAILED' ? 'Try again' : a.role === 'voice' ? 'Create my voice (20 cr)' : 'Create presenter (20 cr)'}</button>)}<button className="btn sm ghost danger" onClick={async () => { await api(`/api/assets/${a.id}`, 'DELETE'); load(); }}>Delete</button></div></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

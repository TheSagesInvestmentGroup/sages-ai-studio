'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { uploadAsset } from '@/lib/upload';
import { useMe, NeedPlan } from '@/components/useMe';

const ROLES: [string, string][] = [['reference', 'Creative reference only'], ['incorporate', 'Include in the production'], ['transform', 'Transform or enhance'], ['reusable', 'Reusable project asset'], ['brand', 'Brand asset (logo, colors, guidelines)'], ['credential', 'Career credential or attachment']];
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Assets() {
  const { me } = useMe();
  const [list, setList] = useState<any[] | null>(null), [role, setRole] = useState('reference'), [rights, setRights] = useState(false), [busy, setBusy] = useState(''), [err, setErr] = useState<any>(null), [over, setOver] = useState(false), [brand, setBrand] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const load = () => api('/api/assets').then(r => { setList(r.assets); setBrand(r.assets.find((a: any) => a.kind === 'brand')?.note || ''); }).catch(setErr);
  useEffect(() => { load(); }, []);

  async function send(files: FileList | null) {
    if (!files?.length) return; setErr(null);
    if (!rights) { setErr({ message: 'Confirm that you own these files or have permission to use them.' }); return; }
    for (const file of Array.from(files)) {
      setBusy(`Uploading ${file.name}…`);
      try { await uploadAsset(file, { name: file.name, role, rights }); } catch (e: any) { setErr(e); break; }
    }
    setBusy(''); if (input.current) input.current.value = ''; load();
  }
  return (
    <div className="stack-lg">
      <div className="stack"><h1 style={{ fontSize: '2rem' }}>My Assets</h1><p className="muted" style={{ maxWidth: 680 }}>Your private library of footage, audio, images, scripts and brand files. Files are stored privately and are never used to train AI models.</p></div>
      {err && (err.needsPlan ? <NeedPlan text={err.message} /> : <div className="notice bad" role="alert">{err.message}</div>)}
      <div className="panel stack" onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }} style={over ? { borderColor: 'var(--gold)' } : undefined}>
        <h3>Add files</h3>
        <div className="grid g2">
          <label className="field">How should the studio use these files?<select id="asset-role" value={role} onChange={e => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="field">Choose files, or drop them anywhere on this panel<input id="asset-file" ref={input} type="file" multiple accept=".mp4,.mov,.webm,.mp3,.wav,.aac,.m4a,.png,.jpg,.jpeg,.webp,.pdf,.docx,.txt,.srt,.vtt" onChange={e => send(e.target.files)} disabled={!!busy} /></label>
        </div>
        <label className="check"><input id="asset-rights" type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} />I own these files or have permission to use them, including any people, voices, music and logos in them.</label>
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
              <td><button className="btn sm ghost danger" onClick={async () => { await api(`/api/assets/${a.id}`, 'DELETE'); load(); }}>Delete</button></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

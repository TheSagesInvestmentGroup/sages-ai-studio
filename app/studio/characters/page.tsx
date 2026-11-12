'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { NeedPlan } from '@/components/useMe';

const BLANK = { name: '', appearance: '', wardrobe: '', personality: '', voice: '', relationships: '', backstory: '', realPerson: false, consent: false };
const FIELDS: [keyof typeof BLANK, string, string][] = [['appearance', 'Appearance', 'Age, build, face, hair, distinguishing features'], ['wardrobe', 'Wardrobe', 'Signature clothing and colors'], ['personality', 'Personality', 'Temperament, how they speak, emotional range'], ['voice', 'Voice', 'Accent, pace, tone'], ['relationships', 'Relationships', 'How they relate to your other characters'], ['backstory', 'Backstory', 'Where they come from and what they want']];

export default function Characters() {
  const [list, setList] = useState<any[] | null>(null), [f, setF] = useState<any>(BLANK), [edit, setEdit] = useState<string | null>(null), [err, setErr] = useState<any>(null), [busy, setBusy] = useState(false);
  const load = () => api('/api/characters').then(r => setList(r.characters)).catch(setErr);
  useEffect(() => { load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api(edit ? `/api/characters/${edit}` : '/api/characters', edit ? 'PATCH' : 'POST', f); setF(BLANK); setEdit(null); await load(); } catch (e: any) { setErr(e); } finally { setBusy(false); }
  }
  return (
    <div className="stack-lg">
      <div className="stack"><h1 style={{ fontSize: '2rem' }}>Characters</h1><p className="muted" style={{ maxWidth: 680 }}>Create an actor once and cast them in any production. Their look and wardrobe are restated in every scene to keep them consistent. AI video models can still drift between scenes, so review each render.</p></div>
      {err && (err.needsPlan ? <NeedPlan text={err.message} /> : <div className="notice bad" role="alert">{err.message}</div>)}
      <div className="work">
        <div className="stack">
          {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <div className="panel"><h3>No characters yet</h3><p className="muted">Describe your first actor in the form. They will appear here, ready to cast from the Create screen in Professional Studio mode.</p></div> :
            list.map(c => (
              <div className="panel stack" key={c.id} style={{ gap: 8 }}>
                <div className="row between"><h3>{c.name}</h3><span className="row"><button className="btn sm" onClick={() => { setEdit(c.id); setF({ ...BLANK, ...c }); }}>Edit</button><button className="btn sm ghost danger" onClick={async () => { await api(`/api/characters/${c.id}`, 'DELETE'); load(); }}>Delete</button></span></div>
                {c.real_person && <span className="pill info">Real person · consent on record</span>}
                {FIELDS.map(([k, label]) => c[k] ? <p className="small muted" key={k}><b style={{ color: 'var(--text)' }}>{label}. </b>{c[k]}</p> : null)}
              </div>
            ))}
        </div>
        <form className="panel stack" onSubmit={save}>
          <h3>{edit ? 'Edit character' : 'New character'}</h3>
          <label className="field">Name<input id="char-name" required maxLength={60} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          {FIELDS.map(([k, label, hint]) => <label className="field" key={k}>{label}<input id={`char-${k}`} required={k === 'appearance'} placeholder={hint} maxLength={600} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>)}
          {!edit && <label className="check"><input type="checkbox" checked={f.realPerson} onChange={e => setF({ ...f, realPerson: e.target.checked })} />This character is based on a real person</label>}
          {!edit && f.realPerson && <label className="check"><input type="checkbox" checked={f.consent} onChange={e => setF({ ...f, consent: e.target.checked })} />I am this person, or I hold their written permission to depict them. This confirmation is recorded.</label>}
          <div className="row"><button className="btn primary" id="save-character" disabled={busy}>{busy ? <span className="spin" /> : edit ? 'Save changes' : 'Add to library'}</button>{edit && <button type="button" className="btn ghost" onClick={() => { setEdit(null); setF(BLANK); }}>Cancel</button>}</div>
        </form>
      </div>
    </div>
  );
}

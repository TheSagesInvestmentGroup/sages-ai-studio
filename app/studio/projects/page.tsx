'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';

const STATUS: Record<string, [string, string]> = { concept: ['Choose a direction', 'gold'], planned: ['Planned', 'gold'], animatic: ['Animatic ready', 'good'], in_production: ['Rendering', 'info'], ready: ['Ready', 'good'] };

export default function Projects() {
  const [list, setList] = useState<any[] | null>(null), [q, setQ] = useState(''), [err, setErr] = useState('');
  useEffect(() => { api('/api/projects').then(r => setList(r.projects)).catch(e => setErr(e.message)); }, []);
  const shown = useMemo(() => (list || []).filter(p => (p.title + p.prompt + p.style + (p.folder || '')).toLowerCase().includes(q.toLowerCase())), [list, q]);
  return (
    <div className="stack-lg">
      <div className="row between"><h1 style={{ fontSize: '2rem' }}>My Projects</h1><Link className="btn primary" href="/studio">New production</Link></div>
      {err && <div className="notice bad">{err}</div>}
      <input id="search" placeholder="Search projects by title, idea, style or folder" value={q} onChange={e => setQ(e.target.value)} aria-label="Search projects" />
      {list === null ? <p className="muted">Loading your projects…</p> : shown.length === 0 ? (
        <div className="panel center stack" style={{ alignItems: 'center' }}><h3>{list.length ? 'No projects match that search' : 'Your first production starts with one sentence'}</h3><p className="muted">{list.length ? 'Try a different word.' : 'Describe an idea and your Creative Director will offer three ways to tell it.'}</p>{!list.length && <Link className="btn primary" href="/studio">Create something</Link>}</div>
      ) : (
        <div className="panel tight scroll-x"><table>
          <thead><tr><th>Production</th><th>Style</th><th className="num">Length</th><th>Format</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>{shown.map(p => <tr key={p.id}><td><Link href={`/studio/projects/${p.id}`}><b>{p.title}</b></Link>{p.folder && <span className="faint small"> · {p.folder}</span>}<div className="muted small">{p.kind === 'bio' ? 'Career story' : p.prompt.slice(0, 90)}</div></td><td>{p.style}</td><td className="num">{p.duration}s</td><td>{p.aspect}</td><td><span className={`pill ${STATUS[p.status]?.[1] || ''}`}>{STATUS[p.status]?.[0] || p.status}</span></td><td className="muted small">{new Date(p.updated_at).toLocaleDateString()}</td></tr>)}</tbody>
        </table></div>
      )}
    </div>
  );
}

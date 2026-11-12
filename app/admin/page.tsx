'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { PLANS } from '@/lib/plans';
import { Toast } from '@/components/useMe';

export default function Admin() {
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [toast, setToast] = useState(''), [reply, setReply] = useState<Record<string, string>>({}), [ask, setAsk] = useState<string | null>(null);
  const load = useCallback(() => api('/api/admin').then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function act(body: any, done: string) { setErr(''); try { const r = await api('/api/admin', 'POST', body); setToast(r.refunded ? `Refunded $${r.refunded.toFixed(2)}.` : done); setTimeout(() => setToast(''), 3500); load(); } catch (e: any) { setErr(e.message); } }
  if (!d) return <main className="wrap studio"><p className="muted">{err || 'Loading the control center…'}</p></main>;
  const s = d.stats;
  return (
    <main className="wrap studio stack-lg">
      <div className="stack"><span className="eyebrow">Owner only</span><h1 style={{ fontSize: '2rem' }}>Control center</h1></div>
      {err && <div className="notice bad" role="alert">{err}</div>}
      <div className="panel grid g4">
        <div className="stat"><span>Paying members</span><b>{s.paying}</b><span>of {s.members} accounts</span></div>
        <div className="stat"><span>Monthly revenue</span><b>${s.monthly_revenue.toLocaleString()}</b><span>from active plans</span></div>
        <div className="stat"><span>Productions</span><b>{s.projects}</b><span>{s.rendering} scenes rendering</span></div>
        <div className="stat"><span>Credits spent</span><b>{s.credits_spent.toLocaleString()}</b><span>{s.credits_refunded.toLocaleString()} refunded</span></div>
        <div className="stat"><span>Failed renders</span><b style={{ color: s.failed ? 'var(--bad)' : undefined }}>{s.failed}</b></div>
        <div className="stat"><span>Waiting on you</span><b style={{ color: s.escalated ? 'var(--warn)' : undefined }}>{s.escalated}</b><span>escalated tickets</span></div>
      </div>
      <div className="row">{s.by_tier.map((t: any) => <span className="pill" key={t.name}>{t.name}: {t.count}</span>)}</div>

      <section className="stack"><h2>Connected services</h2>
        <div className="panel tight scroll-x"><table><thead><tr><th>Area</th><th>Service</th><th>Status</th><th>Detail</th></tr></thead><tbody>{d.providers.map((p: any) => <tr key={p.area}><td>{p.area}</td><td>{p.provider}</td><td><span className={`pill ${p.live ? 'good' : 'warn'}`}>{p.live ? 'Live' : 'Not connected'}</span></td><td className="muted small">{p.note}</td></tr>)}</tbody></table></div>
      </section>

      <section className="stack"><h2>Support tickets</h2>
        {d.tickets.length === 0 ? <p className="muted">No conversations yet.</p> : d.tickets.filter((t: any) => t.status !== 'closed').map((t: any) => (
          <div className="panel stack" key={t.id}>
            <div className="row between"><b>{t.name} <span className="muted small">{t.email}</span></b><span className={`pill ${t.status === 'escalated' ? 'warn' : 'good'}`}>{t.status === 'escalated' ? 'Needs your reply' : 'Handled by assistant'}</span></div>
            <div className="chat">{t.messages.map((m: any, i: number) => <div key={i} className={`msg ${m.role === 'member' ? 'director' : 'you'}`}><b>{m.role}: </b>{m.text}</div>)}</div>
            <div className="row"><input className="grow" placeholder="Reply to the member" aria-label={`Reply to ${t.name}`} value={reply[t.id] || ''} onChange={e => setReply({ ...reply, [t.id]: e.target.value })} /><button className="btn sm primary" onClick={() => { act({ op: 'reply', ticketId: t.id, text: reply[t.id] }, 'Reply sent.'); setReply({ ...reply, [t.id]: '' }); }}>Send reply</button><button className="btn sm" onClick={() => act({ op: 'reply', ticketId: t.id, text: reply[t.id], close: true }, 'Ticket closed.')}>Close ticket</button></div>
          </div>
        ))}
      </section>

      <section className="stack"><h2>Members</h2>
        <div className="panel tight scroll-x"><table>
          <thead><tr><th>Member</th><th>Plan</th><th>Status</th><th className="num">Credits</th><th className="num">Productions</th><th>Paid through</th><th>Actions</th></tr></thead>
          <tbody>{d.members.map((m: any) => (
            <tr key={m.id}><td><b>{m.name}</b><div className="muted small">{m.email}</div></td>
              <td><select aria-label={`Plan for ${m.name}`} value={m.tier || ''} onChange={e => act({ op: 'setTier', userId: m.id, tier: e.target.value || null }, 'Plan updated.')} style={{ minWidth: 130 }}><option value="">None</option>{PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
              <td><span className={`pill ${m.status === 'active' ? 'good' : m.status === 'past_due' ? 'bad' : ''}`}>{m.status}</span></td><td className="num">{m.credits.toLocaleString()}</td><td className="num">{m.videos_used}</td><td className="muted small">{m.period_end ? new Date(m.period_end).toLocaleDateString() : '—'}</td>
              <td><div className="row" style={{ gap: 6 }}><button className="btn sm" onClick={() => act({ op: 'grant', userId: m.id, credits: 500 }, '500 credits added.')}>+500 credits</button>
                {ask === m.id ? <><button className="btn sm danger" onClick={() => { setAsk(null); act({ op: 'refund', userId: m.id }, 'Refunded.'); }}>Confirm refund</button><button className="btn sm ghost" onClick={() => setAsk(null)}>Cancel</button></> : <button className="btn sm ghost" disabled={!m.billing} title={m.billing ? 'Refund the most recent payment in full' : 'No Stripe payment on file'} onClick={() => setAsk(m.id)}>Refund last payment</button>}</div></td></tr>
          ))}</tbody>
        </table></div>
        <p className="small faint">Changing a plan here grants access without charging. Paid plan changes happen through the member’s billing page.</p>
      </section>

      {d.failed.length > 0 && <section className="stack"><h2>Failed renders</h2><div className="panel tight scroll-x"><table><thead><tr><th>Production</th><th>Scene</th><th>Reason</th></tr></thead><tbody>{d.failed.map((f: any, i: number) => <tr key={i}><td>{f.project}</td><td>{f.n}</td><td className="muted">{f.error}</td></tr>)}</tbody></table></div></section>}

      <section className="stack"><h2>Activity log</h2>
        <div className="panel tight scroll-x"><table><thead><tr><th>When</th><th>Event</th><th>Detail</th></tr></thead><tbody>{d.log.map((l: any) => <tr key={l.id}><td className="muted small">{new Date(l.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td><td>{l.action}</td><td className="muted small" style={{ wordBreak: 'break-all' }}>{JSON.stringify(l.detail)}</td></tr>)}</tbody></table></div>
      </section>
      <Toast text={toast} />
    </main>
  );
}

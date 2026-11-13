'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import PlanGrid from '@/components/PlanGrid';
import { PACKS } from '@/lib/plans';

export default function Billing() {
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { api('/api/me?ledger=1').then(setD).catch(e => setErr(e.message)); }, []);
  async function portal() { setBusy(true); try { location.href = (await api('/api/billing/portal', 'POST')).url; } catch (e: any) { setErr(e.message); setBusy(false); } }
  async function buyPack(id: string) { setBusy(true); setErr(''); try { location.href = (await api('/api/billing/pack', 'POST', { pack: id })).url; } catch (e: any) { setErr(e.message); setBusy(false); } }
  if (!d) return <p className="muted">{err || 'Loading your membership…'}</p>;
  const { user, plan, member } = d, welcome = typeof location !== 'undefined' && location.search.includes('welcome'), bought = typeof location !== 'undefined' && location.search.includes('credits=1');
  return (
    <div className="stack-lg">
      <h1 style={{ fontSize: '2rem' }}>Membership &amp; Credits</h1>
      {welcome && member && <div className="notice good">Welcome to {plan.name}. Your studio is open.</div>}
      {welcome && !member && <div className="notice">Your payment is being confirmed. This page will show your membership within a minute; refresh to check.</div>}
      {bought && <div className="notice good">Thank you. Your extra credits are added as soon as the payment is confirmed, usually within a minute. Refresh to see the new balance.</div>}
      {err && <div className="notice bad" role="alert">{err}</div>}
      {user.status === 'past_due' && <div className="notice bad">Your last payment did not go through. Update your payment method to keep your access.</div>}
      {member ? (
        <div className="panel grid g4" style={{ alignItems: 'end' }}>
          <div className="stat"><span>Membership</span><b>{plan.name}</b><span>${plan.price} a month</span></div>
          <div className="stack" style={{ gap: 6 }}><div className="stat"><span>Credits left</span><b>{user.credits.toLocaleString()}</b></div><div className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (user.credits / plan.credits) * 100)}%` }} /></div><span className="small faint">{user.pack_credits > 0 ? `${plan.credits.toLocaleString()} monthly, plus extra credits` : `of ${plan.credits.toLocaleString()} this month`}</span></div>
          <div className="stack" style={{ gap: 6 }}><div className="stat"><span>Productions</span><b>{user.videos_used} / {plan.videos}</b></div><div className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (user.videos_used / plan.videos) * 100)}%` }} /></div><span className="small faint">used this month</span></div>
          <div className="stack" style={{ gap: 8 }}><span className="small muted">Renews {user.period_end ? new Date(user.period_end).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'monthly'}</span>{d.engines.payments && <button className="btn" id="portal" onClick={portal} disabled={busy}>{busy ? <span className="spin" /> : 'Manage billing'}</button>}</div>
        </div>
      ) : <div className="notice">You do not have an active membership. Choose one below to open the studio.</div>}
      {member && d.engines.payments && <p className="muted small">Manage billing opens a secure Stripe page where you can change your card or bank account, switch plan, download invoices, or cancel. Payments continue monthly until you change or cancel them.</p>}
      {member && d.engines.payments && (
        <div className="stack" id="packs"><h2>Add extra credits</h2>
          <p className="muted small">For longer productions. Extra credits are a one-time purchase, are used after your monthly allowance, and carry over each month while your membership is active. They cannot be exchanged for cash.</p>
          <div className="grid g3">{PACKS.map(k => <div className="panel stack" key={k.id}><div className="stat"><span>{k.credits.toLocaleString()} credits</span><b>${k.price}</b><span>about {Math.round(k.credits / 4.2)} seconds of video</span></div><button className="btn" id={`pack-${k.id}`} onClick={() => buyPack(k.id)} disabled={busy}>Buy {k.credits.toLocaleString()} credits</button></div>)}</div>
        </div>
      )}
      <div className="stack"><h2>{member ? 'Change membership' : 'Choose a membership'}</h2><PlanGrid signedIn current={plan?.id} demo={d.demo && !d.engines.payments} /></div>
      {d.ledger?.length > 0 && (
        <div className="stack"><h2>Credit history</h2>
          <div className="panel tight scroll-x"><table><thead><tr><th>When</th><th>What</th><th className="num">Credits</th></tr></thead><tbody>{d.ledger.map((l: any) => <tr key={l.id}><td className="muted small">{new Date(l.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{l.reason}</td><td className="num" style={{ color: l.amount < 0 ? 'var(--text)' : 'var(--good)' }}>{l.amount > 0 ? '+' : ''}{l.amount.toLocaleString()}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}

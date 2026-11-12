'use client';
import { useState } from 'react';
import { PLANS } from '@/lib/plans';
import { api } from '@/lib/client';

export default function PlanGrid({ signedIn, current, demo }: { signedIn: boolean; current?: string | null; demo: boolean }) {
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  async function choose(tier: string) {
    if (!signedIn) { location.href = `/signup?plan=${tier}`; return; }
    setBusy(tier); setErr('');
    try { const r = await api('/api/billing/checkout', 'POST', { tier }); location.href = r.url || '/studio/billing?welcome=1'; }
    catch (e: any) { setErr(e.message); setBusy(''); }
  }
  return (
    <div className="stack">
      {err && <div className="notice bad" role="alert">{err}</div>}
      <div className="grid g3">
        {PLANS.map(p => (
          <div className={`panel plan ${p.id === 'professional' ? 'featured' : ''}`} key={p.id}>
            <div className="row between"><h3>{p.name}</h3>{p.id === current ? <span className="pill good">Your plan</span> : p.id === 'professional' ? <span className="pill gold">Most chosen</span> : null}</div>
            <div className="price">${p.price}<small> / month</small></div>
            <p className="muted small">{p.blurb}</p>
            <ul className="ticks">{p.benefits.map(b => <li key={b}>{b}</li>)}<li>{p.credits.toLocaleString()} rendering credits each month</li></ul>
            <div className="grow" />
            <button className={`btn block ${p.id === 'professional' ? 'primary' : ''}`} id={`choose-${p.id}`} disabled={!!busy || p.id === current} onClick={() => choose(p.id)}>{busy === p.id ? <span className="spin" /> : p.id === current ? 'Current plan' : current ? `Switch to ${p.name}` : `Choose ${p.name}`}</button>
          </div>
        ))}
      </div>
      <p className="muted small">Pay by credit card, debit card or bank account. Payments repeat automatically each month until you change or cancel them, which you can do at any time from Billing. Access ends at the close of the last month you paid for. {demo && <b className="gold">Demo mode: choosing a plan activates it without payment.</b>}</p>
    </div>
  );
}

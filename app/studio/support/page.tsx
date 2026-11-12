'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';

const STARTERS = ['How do credits work?', 'How do I cancel?', 'How do I change my payment method?', 'What files can I upload?'];
export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]), [cur, setCur] = useState<any>(null), [text, setText] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { api('/api/support').then(r => { setTickets(r.tickets); setCur(r.tickets.find((t: any) => t.status !== 'closed') || null); }).catch(e => setErr(e.message)); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [cur?.messages?.length]);
  async function send(message: string, escalate = false) {
    if (!message.trim()) return; setBusy(true); setErr(''); setText('');
    try { const r = await api('/api/support', 'POST', { message, ticketId: cur?.id, escalate }); setCur(r.ticket); setTickets(t => [r.ticket, ...t.filter(x => x.id !== r.ticket.id)]); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="stack-lg" style={{ maxWidth: 760 }}>
      <div className="stack"><h1 style={{ fontSize: '2rem' }}>Help Center</h1><p className="muted">The studio assistant answers common questions right away. Billing problems, refunds and account issues go to the studio owner.</p></div>
      {err && <div className="notice bad" role="alert">{err}</div>}
      <div className="panel stack">
        <div className="row between"><h3>{cur ? cur.subject : 'New conversation'}</h3>{cur && <span className={`pill ${cur.status === 'escalated' ? 'warn' : cur.status === 'closed' ? '' : 'good'}`}>{cur.status === 'escalated' ? 'With the owner' : cur.status === 'closed' ? 'Closed' : 'Open'}</span>}</div>
        <div className="chat" style={{ maxHeight: 420 }} aria-live="polite">
          {!cur && <p className="muted small">Ask a question to begin.</p>}
          {cur?.messages.map((m: any, i: number) => <div key={i} className={`msg ${m.role}`}>{m.role === 'owner' && <b className="gold">Studio owner: </b>}{m.text}</div>)}
          {busy && <div className="msg agent"><span className="spin" /></div>}
          <div ref={end} />
        </div>
        <form className="row" onSubmit={e => { e.preventDefault(); send(text); }}><input id="support-text" className="grow" value={text} onChange={e => setText(e.target.value)} placeholder="Type your question" maxLength={2000} aria-label="Your question" /><button className="btn primary sm" id="support-send" disabled={busy || text.trim().length < 2}>Send</button></form>
        <div className="row" style={{ gap: 6 }}>{STARTERS.map(s => <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>{s}</button>)}{cur && cur.status === 'open' && <button className="chip" onClick={() => send('Please pass this conversation to the studio owner.', true)} disabled={busy}>Send to the owner</button>}{cur && <button className="chip" onClick={() => setCur(null)}>Start a new conversation</button>}</div>
      </div>
      {tickets.length > 1 && <div className="stack"><h3>Earlier conversations</h3>{tickets.filter(t => t.id !== cur?.id).map(t => <button key={t.id} className="scene" style={{ gridTemplateColumns: '1fr' }} onClick={() => setCur(t)}><span className="row between"><b>{t.subject}</b><span className="muted small">{new Date(t.updated_at).toLocaleDateString()}</span></span></button>)}</div>}
    </div>
  );
}

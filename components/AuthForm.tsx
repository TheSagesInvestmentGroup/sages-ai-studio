'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('');
    const f = Object.fromEntries(new FormData(e.currentTarget)) as any;
    try {
      const r = await api(`/api/auth/${mode}`, 'POST', { ...f, agree: f.agree === 'on' });
      if (r.confirm) { setSent(true); return; }
      const plan = new URLSearchParams(location.search).get('plan');
      location.href = mode === 'signup' ? `/onboarding${plan ? `?plan=${plan}` : ''}` : '/studio';
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  if (sent) return <div className="stack" style={{ maxWidth: 400 }}><h2>Check your email</h2><p className="muted">We sent you a confirmation message. Open it and press the button to finish creating your account.</p></div>;
  return (
    <form className="stack" style={{ width: '100%', maxWidth: 400 }} onSubmit={submit}>
      <h2>{mode === 'signup' ? 'Become a member' : 'Welcome back'}</h2>
      {err && <div className="notice bad" role="alert">{err}</div>}
      {mode === 'signup' && <label className="field">Your name<input id="name" name="name" required maxLength={80} autoComplete="name" /></label>}
      <label className="field">Email<input id="email" name="email" type="email" required autoComplete="email" /></label>
      <label className="field">Password<input id="password" name="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
      {mode === 'signup' && <label className="check"><input id="agree" name="agree" type="checkbox" required /><span>I agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>, and I am 18 or older.</span></label>}
      <button className="btn primary block" id="submit" disabled={busy}>{busy ? <span className="spin" /> : mode === 'signup' ? 'Create my account' : 'Sign in'}</button>
      <p className="muted small">{mode === 'signup' ? <>Already a member? <Link href="/login">Sign in</Link></> : <>New here? <Link href="/signup">Become a member</Link></>}</p>
    </form>
  );
}

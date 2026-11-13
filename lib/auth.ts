import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { cfg, isDemo } from './config';
import { db, Row, now } from './store';
import { planOf } from './plans';

const COOKIE = 'sage_session';

export function sbServer() {
  const c = cookies();
  return createServerClient(cfg.supabaseUrl, cfg.supabaseAnon, {
    cookies: {
      getAll: () => c.getAll(),
      setAll: (list: { name: string; value: string; options?: any }[]) => {
        try { list.forEach(({ name, value, options }) => c.set(name, value, options)); } catch { /* called from a Server Component */ }
      },
    },
  });
}

const sign = (v: string) => crypto.createHmac('sha256', cfg.sessionSecret).update(v).digest('hex');
const hashPw = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 32).toString('hex');

async function ensureProfile(id: string, email: string, name?: string): Promise<Row> {
  const existing = await db.get('profiles', id);
  if (existing) return existing;
  const first = isDemo && !cfg.ownerEmail && (await db.list('profiles', {}, { limit: 1 })).length === 0;
  return db.insert('profiles', {
    id, email: email.toLowerCase(), name: name || email.split('@')[0], interests: [], tier: null, status: 'none',
    credits: 0, videos_used: 0, period_end: null, onboarded: false, role: first ? 'owner' : 'member',
    stripe_customer_id: null, stripe_subscription_id: null,
  });
}

export async function getUser(): Promise<Row | null> {
  if (isDemo) {
    const raw = cookies().get(COOKIE)?.value; if (!raw) return null;
    const [id, sig] = raw.split('.');
    if (!id || !sig || sig.length !== 64 || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(id)))) return null;
    return db.get('profiles', id);
  }
  const { data } = await sbServer().auth.getUser();
  if (!data.user) return null;
  return ensureProfile(data.user.id, data.user.email || '', data.user.user_metadata?.name);
}

export const isOwner = (u: Row | null) => !!u && (u.role === 'owner' || (!!cfg.ownerEmail && u.email === cfg.ownerEmail));

/** Access ends the month after payment stops: status must be active and the paid period current. */
export function membership(u: Row | null) {
  if (isOwner(u)) { const p = planOf(u?.tier) || planOf('business'); return { active: true, plan: p }; }
  const plan = planOf(u?.tier);
  const current = !u?.period_end || new Date(u.period_end).getTime() > Date.now() - 3 * 864e5;
  const active = !!plan && u?.status === 'active' && current;
  return { active, plan: active ? plan : null };
}

export async function signUp(email: string, password: string, name: string): Promise<{ ok: boolean; message?: string; confirm?: boolean }> {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  if (password.length < 8) return { ok: false, message: 'Use a password of at least 8 characters.' };
  if (isDemo) {
    if ((await db.list('demo_auth', { email })).length) return { ok: false, message: 'An account with this email already exists. Sign in instead.' };
    const salt = crypto.randomBytes(16).toString('hex');
    const p = await ensureProfile(crypto.randomUUID(), email, name);
    await db.insert('demo_auth', { id: p.id, email, salt, hash: hashPw(password, salt) });
    cookies().set(COOKIE, `${p.id}.${sign(p.id)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return { ok: true };
  }
  const { data, error } = await sbServer().auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${cfg.siteUrl}/auth/confirm` } });
  if (error) return { ok: false, message: error.message };
  if (data.user && data.session) { await ensureProfile(data.user.id, email, name); return { ok: true }; }
  return { ok: true, confirm: true };
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
  email = email.trim().toLowerCase();
  const bad = { ok: false, message: 'That email and password do not match.' };
  if (isDemo) {
    const [a] = await db.list('demo_auth', { email });
    if (!a || hashPw(password, a.salt) !== a.hash) return bad;
    cookies().set(COOKIE, `${a.id}.${sign(a.id)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return { ok: true };
  }
  const { error } = await sbServer().auth.signInWithPassword({ email, password });
  return error ? { ok: false, message: error.message.includes('confirm') ? 'Confirm your email first. Check your inbox.' : bad.message } : { ok: true };
}

export async function signOut() {
  if (isDemo) cookies().delete(COOKIE); else await sbServer().auth.signOut();
}

// ---------- credits ----------
export async function spendCredits(user: Row, amount: number, reason: string, ref: Row = {}): Promise<boolean> {
  if (amount <= 0) return true;
  if (isDemo) {
    const p = await db.get('profiles', user.id);
    if (!p || p.credits < amount) return false;
    await db.update('profiles', user.id, { credits: p.credits - amount });
  } else {
    const { admin } = await import('./store');
    const { data, error } = await admin().rpc('spend_credits', { p_user: user.id, p_amount: amount });
    if (error || data !== true) return false;
  }
  await db.insert('credit_ledger', { user_id: user.id, amount: -amount, reason, ref });
  return true;
}

export async function addCredits(userId: string, amount: number, reason: string, ref: Row = {}) {
  if (isDemo) {
    const p = await db.get('profiles', userId); if (!p) return;
    await db.update('profiles', userId, { credits: p.credits + amount });
  } else {
    const { admin } = await import('./store');
    await admin().rpc('add_credits', { p_user: userId, p_amount: amount });
  }
  await db.insert('credit_ledger', { user_id: userId, amount, reason, ref });
}

/** Start or renew a paid month: reset the credit allowance and production count. */
export async function activateTier(userId: string, tier: string, extra: Row = {}, periodEnd?: string) {
  const plan = planOf(tier); if (!plan) return;
  await db.update('profiles', userId, {
    tier, status: 'active', credits: plan.credits, videos_used: 0,
    period_end: periodEnd || new Date(Date.now() + 31 * 864e5).toISOString(), ...extra,
  });
  await db.insert('credit_ledger', { user_id: userId, amount: plan.credits, reason: `Monthly allowance: ${plan.name}`, ref: { at: now() } });
}

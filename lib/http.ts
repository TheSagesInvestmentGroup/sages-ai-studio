import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getUser, membership } from './auth';
import type { Row } from './store';

export const ok = (data: any = {}) => NextResponse.json(data);
export const fail = (status: number, message: string, extra: Row = {}) => NextResponse.json({ error: message, ...extra }, { status });

// Best-effort limiter. Serverless instances do not share memory, so this slows
// abuse rather than guaranteeing a hard cap; the credit system is the hard cap.
const hits = new Map<string, number[]>();
export function limited(bucket: string, max: number, windowMs = 60_000) {
  const ip = headers().get('x-nf-client-connection-ip') || headers().get('x-forwarded-for')?.split(',')[0] || 'local';
  const key = `${bucket}:${ip}`, t = Date.now();
  const list = (hits.get(key) || []).filter(x => t - x < windowMs);
  list.push(t); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

/** State-changing requests must come from our own pages. */
export function sameOrigin() {
  const h = headers(), origin = h.get('origin');
  if (!origin) return true; // non-browser client or same-origin GET
  try { return new URL(origin).host === h.get('host'); } catch { return false; }
}

type Handler = (user: Row, body: any) => Promise<Response>;
/** Signed-in member route with origin check, rate limit and safe error handling. */
export async function withUser(req: Request, handler: Handler, opts: { member?: boolean; limit?: number } = {}) {
  try {
    if (req.method !== 'GET' && !sameOrigin()) return fail(403, 'This request came from another site and was blocked.');
    if (limited(new URL(req.url).pathname, opts.limit ?? 60)) return fail(429, 'Too many requests. Wait a minute and try again.');
    const user = await getUser();
    if (!user) return fail(401, 'Sign in to continue.');
    if (opts.member && !membership(user).active) return fail(402, 'Choose a membership to start creating.', { needsPlan: true });
    let body: any = {};
    if (req.method !== 'GET' && (req.headers.get('content-type') || '').includes('application/json')) body = await req.json().catch(() => ({}));
    return await handler(user, body);
  } catch (e: any) {
    console.error('[api]', new URL(req.url).pathname, e?.message);
    return fail(500, 'Something went wrong on our side. Your work is saved. Try again.');
  }
}

export const clean = (v: unknown, max = 4000) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

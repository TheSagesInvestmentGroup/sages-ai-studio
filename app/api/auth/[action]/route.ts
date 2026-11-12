import { ok, fail, limited, sameOrigin, clean } from '@/lib/http';
import { signIn, signOut, signUp } from '@/lib/auth';
import { audit } from '@/lib/store';

export async function POST(req: Request, { params }: { params: { action: string } }) {
  if (!sameOrigin()) return fail(403, 'Blocked.');
  if (limited('auth', 10)) return fail(429, 'Too many attempts. Wait a minute and try again.');
  const b = await req.json().catch(() => ({}));
  try {
    if (params.action === 'signup') {
      if (!b.agree) return fail(400, 'Please accept the terms to create an account.');
      const r = await signUp(clean(b.email, 200), String(b.password || ''), clean(b.name, 80));
      if (!r.ok) return fail(400, r.message || 'Could not create the account.');
      await audit(null, 'signup', { email: clean(b.email, 200).toLowerCase() });
      return ok(r);
    }
    if (params.action === 'login') {
      const r = await signIn(clean(b.email, 200), String(b.password || ''));
      return r.ok ? ok(r) : fail(401, r.message || 'Sign-in failed.');
    }
    if (params.action === 'logout') { await signOut(); return ok(); }
    return fail(404, 'Unknown action.');
  } catch (e: any) { console.error('[auth]', e?.message); return fail(500, 'Sign-in is unavailable right now. Try again shortly.'); }
}

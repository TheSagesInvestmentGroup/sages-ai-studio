import { redirect } from 'next/navigation';
import { sbServer } from '@/lib/auth';
import { isDemo } from '@/lib/config';

export const metadata = { title: 'Confirm your email' };
export const dynamic = 'force-dynamic';

// The confirmation link lands on a page with a button rather than confirming on load,
// because email security scanners open links and would use up a one-time token.
export default function Confirm({ searchParams }: { searchParams: { token_hash?: string; type?: string; error?: string } }) {
  async function confirm() {
    'use server';
    if (isDemo || !searchParams.token_hash) redirect('/login');
    const { error } = await sbServer().auth.verifyOtp({ token_hash: searchParams.token_hash!, type: (searchParams.type as any) || 'signup' });
    redirect(error ? '/auth/confirm?error=1' : '/onboarding');
  }
  return (
    <main className="wrap section center stack" style={{ alignItems: 'center' }}>
      <h1>Confirm your email</h1>
      {searchParams.error ? <p className="notice bad">That link has expired or was already used. Sign in, or sign up again to get a new one.</p> : <p className="muted">Press the button to finish creating your account.</p>}
      <form action={confirm}><button className="btn primary">Confirm and enter the studio</button></form>
    </main>
  );
}

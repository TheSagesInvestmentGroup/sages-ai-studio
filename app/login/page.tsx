import AuthForm from '@/components/AuthForm';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  if (await getUser().catch(() => null)) redirect('/studio');
  return (
    <main className="split">
      <div className="art"><div className="stack" style={{ maxWidth: 420 }}><span className="eyebrow">The Sages AI Studio</span><h2>Your vision. Your story. Your production.</h2></div></div>
      <div className="form"><AuthForm mode="login" /></div>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (!user.onboarded) redirect('/onboarding');
  return <main className="wrap studio">{children}</main>;
}

import { notFound, redirect } from 'next/navigation';
import { getUser, isOwner } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser(); if (!user) redirect('/login'); if (!isOwner(user)) notFound();
  return <>{children}</>;
}

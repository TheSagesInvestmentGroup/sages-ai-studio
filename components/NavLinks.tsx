'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ signedIn, owner }: { signedIn: boolean; owner: boolean }) {
  const path = usePathname();
  const links = signedIn
    ? [['/studio', 'Create'], ['/studio/projects', 'Projects'], ['/studio/characters', 'Characters'], ['/studio/assets', 'Assets'], ['/studio/bio', 'Bio & Résumé'], ['/studio/support', 'Help'], ...(owner ? [['/admin', 'Control center']] : [])]
    : [['/#how', 'How it works'], ['/pricing', 'Membership']];
  const on = (href: string) => (href === '/studio' ? path === '/studio' : path.startsWith(href));
  return <nav className="nav" aria-label="Main">{links.map(([href, label]) => <Link key={href} href={href} className={on(href) ? 'on' : ''}>{label}</Link>)}</nav>;
}

export function LogoutButton() {
  return <button className="btn sm ghost" id="logout" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/'; }}>Sign out</button>;
}

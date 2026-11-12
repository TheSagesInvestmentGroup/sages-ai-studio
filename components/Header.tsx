import Link from 'next/link';
import { getUser, isOwner, membership } from '@/lib/auth';
import { isDemo } from '@/lib/config';
import NavLinks, { LogoutButton } from './NavLinks';

export default async function Header() {
  const user = await getUser().catch(() => null);
  const m = membership(user);
  return (
    <header className="top">
      <div className="wrap">
        <Link href={user ? '/studio' : '/'} className="brand"><span className="mark" aria-hidden="true" />THE SAGES AI STUDIO</Link>
        {isDemo && <span className="pill warn" title="No accounts are connected. Data is stored locally.">Demo mode</span>}
        <div className="grow" />
        <NavLinks signedIn={!!user} owner={isOwner(user)} />
        {user ? (
          <div className="row">
            {m.active && <Link href="/studio/billing" className="pill gold" title="Credits left this month">{user.credits.toLocaleString()} credits</Link>}
            <LogoutButton />
          </div>
        ) : (
          <div className="row"><Link className="btn sm ghost" href="/login">Sign in</Link><Link className="btn sm primary" href="/signup">Become a member</Link></div>
        )}
      </div>
    </header>
  );
}

import Link from 'next/link';
export default function NotFound() { return <main className="wrap section center stack" style={{ alignItems: 'center' }}><h1>That page is not here</h1><p className="muted">The link may be old, or sharing may have been turned off.</p><Link className="btn primary" href="/">Go to the studio</Link></main>; }

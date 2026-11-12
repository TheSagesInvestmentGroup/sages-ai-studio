import { NextResponse } from 'next/server';
import { ok, fail, withUser, clean } from '@/lib/http';
import { db, owned, audit } from '@/lib/store';
import { getUser } from '@/lib/auth';
import { readLocal, saveLocal, removeFile, signedUrl } from '@/lib/files';
import { isDemo } from '@/lib/config';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

// Download. Owners always; visitors only for attachments the owner made available on a shared portfolio.
export async function GET(req: Request, { params }: Ctx) {
  const a = await db.get('assets', params.id); if (!a || !a.ready) return fail(404, 'File not found.');
  const user = await getUser();
  if (a.user_id !== user?.id) {
    const slug = new URL(req.url).searchParams.get('p') || '';
    const [proj] = slug ? await db.list('projects', { share_slug: slug }) : [];
    const allowed = proj?.shared && proj.user_id === a.user_id && (proj.portfolio?.attachments || []).includes(a.id) && a.visibility !== 'private';
    if (!allowed) return fail(404, 'File not found.');
  }
  if (!isDemo) { const url = await signedUrl(a.path, 300); return url ? NextResponse.redirect(url) : fail(404, 'File not found.'); }
  const data = readLocal(a.id); if (!data) return fail(404, 'File not found.');
  return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': a.mime || 'application/octet-stream', 'Content-Disposition': `inline; filename="${a.name.replace(/"/g, '')}"`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}

// Demo-mode upload body. In production the browser uploads straight to private storage.
export const PUT = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const a = await owned('assets', params.id, user.id); if (!a) return fail(404, 'File not found.');
  if (isDemo) { const buf = Buffer.from(await req.arrayBuffer()); if (buf.length > 20 * 1024 * 1024) return fail(400, 'File is too large.'); saveLocal(a.id, buf); }
  return ok({ asset: await db.update('assets', a.id, { ready: true }) });
});

export const PATCH = (req: Request, { params }: Ctx) => withUser(req, async (user, b) => {
  const a = await owned('assets', params.id, user.id); if (!a) return fail(404, 'File not found.');
  const patch: any = {};
  if (['private', 'link', 'public'].includes(b.visibility)) patch.visibility = b.visibility;
  if (typeof b.note === 'string') patch.note = clean(b.note, 800);
  if (b.ready === true) patch.ready = true;
  return ok({ asset: await db.update('assets', a.id, patch) });
});

export const DELETE = (req: Request, { params }: Ctx) => withUser(req, async user => {
  const a = await owned('assets', params.id, user.id); if (!a) return fail(404, 'File not found.');
  await removeFile(a as any); await db.remove('assets', a.id); await audit(user.id, 'asset.delete', { asset: a.id });
  return ok();
});

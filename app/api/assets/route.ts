import { ok, fail, withUser, clean } from '@/lib/http';
import { db, newId, audit } from '@/lib/store';
import { ASSET_ROLES, kindOf } from '@/lib/fields';
import { uploadTarget, signedUrl } from '@/lib/files';
import { isDemo } from '@/lib/config';
import { membership } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const MAX = isDemo ? 20 * 1024 * 1024 : 400 * 1024 * 1024;

export const GET = (req: Request) => withUser(req, async user => {
  const rows = await db.list('assets', { user_id: user.id }, { order: 'created_at' });
  const assets = await Promise.all(rows.map(async a => ({ ...a, url: a.ready ? (isDemo ? `/api/assets/${a.id}` : await signedUrl(a.path)) : null })));
  return ok({ assets });
});

// Step 1 of an upload: validate, record rights confirmation, hand back a one-time upload target.
export const POST = (req: Request) => withUser(req, async (user, b) => {
  const name = clean(b.name, 140).replace(/[^\w.\- ()]/g, '_'), kind = kindOf(name), size = +b.size || 0;
  const role = ASSET_ROLES.includes(b.role) ? b.role : 'reference';
  if (role === 'brand' && typeof b.note === 'string' && !b.name) { // Brand Memory text profile (no file)
    if (!membership(user).plan?.brand) return fail(402, 'Brand Memory is part of the Business membership.', { needsPlan: true });
    const row = await db.insert('assets', { user_id: user.id, name: 'Brand profile', kind: 'brand', role: 'brand', note: clean(b.note, 800), size: 0, ready: true, visibility: 'private' });
    return ok({ asset: row });
  }
  if (!kind) return fail(400, 'That file type is not supported. Use MP4, MOV, WEBM, MP3, WAV, AAC, PNG, JPG, WEBP, PDF, DOCX, TXT or SRT.');
  if (size <= 0 || size > MAX) return fail(400, `Files can be up to ${Math.round(MAX / 1048576)} MB.`);
  if (!b.rights) return fail(400, 'Confirm that you own this file or have permission to use it.');
  if ((role === 'voice' || role === 'avatar') && !b.consent) return fail(400, 'Voice and likeness files need the consent of the person recorded.');
  const id = newId(), path = `${user.id}/${id}/${name}`;
  const row = await db.insert('assets', { id, user_id: user.id, name, kind, role, note: clean(b.note, 300), size, mime: clean(b.type, 80), path, ready: false, visibility: 'private' });
  if (role === 'voice' || role === 'avatar') await db.insert('consents', { user_id: user.id, kind: role === 'voice' ? 'voice' : 'likeness', subject: clean(b.subject, 80) || user.name, statement: 'Member confirmed this is their own voice or likeness, or that they hold the person’s written permission, and agreed to its use for synthetic media in their productions.', ref: id });
  await audit(user.id, 'asset.create', { asset: id, role });
  return ok({ asset: row, upload: await uploadTarget(path) });
}, { member: true, limit: 40 });

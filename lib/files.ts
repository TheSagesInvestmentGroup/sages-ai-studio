// Member file storage: private Supabase bucket in production, local folder in demo mode.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { admin } from './store';
import { isDemo } from './config';

function dir() { let d = path.join(process.cwd(), '.data', 'uploads'); try { fs.mkdirSync(d, { recursive: true }); } catch { d = path.join(os.tmpdir(), 'sages-uploads'); fs.mkdirSync(d, { recursive: true }); } return d; }
const local = (id: string) => path.join(dir(), id.replace(/[^a-z0-9-]/gi, ''));

export async function uploadTarget(assetPath: string) {
  if (isDemo) return { mode: 'direct' as const };
  const { data, error } = await admin().storage.from('assets').createSignedUploadUrl(assetPath);
  if (error || !data) throw new Error(error?.message || 'upload url');
  return { mode: 'signed' as const, path: assetPath, token: data.token };
}
export const saveLocal = (id: string, data: Buffer) => fs.writeFileSync(local(id), data);
export const readLocal = (id: string) => { try { return fs.readFileSync(local(id)); } catch { return null; } };
export async function signedUrl(assetPath: string, seconds = 3600) {
  const { data } = await admin().storage.from('assets').createSignedUrl(assetPath, seconds);
  return data?.signedUrl || null;
}
export async function removeFile(asset: { id: string; path: string }) {
  if (isDemo) { try { fs.unlinkSync(local(asset.id)); } catch { /* already gone */ } return; }
  await admin().storage.from('assets').remove([asset.path]);
}

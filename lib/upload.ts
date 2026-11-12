'use client';
import { api } from './client';

/** Register the file, then send its bytes straight to private storage (or to the demo store). */
export async function uploadAsset(file: File | Blob, meta: { name: string; role: string; rights: boolean; consent?: boolean; note?: string; subject?: string }) {
  const r = await api('/api/assets', 'POST', { ...meta, size: file.size, type: file.type });
  if (r.upload.mode === 'signed') {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await sb.storage.from('assets').uploadToSignedUrl(r.upload.path, r.upload.token, file, { contentType: file.type });
    if (error) { await api(`/api/assets/${r.asset.id}`, 'DELETE').catch(() => {}); throw new Error('The upload did not finish. Check your connection and try again.'); }
    await api(`/api/assets/${r.asset.id}`, 'PATCH', { ready: true });
  } else {
    const res = await fetch(`/api/assets/${r.asset.id}`, { method: 'PUT', body: file });
    if (!res.ok) { await api(`/api/assets/${r.asset.id}`, 'DELETE').catch(() => {}); throw new Error('The upload did not finish. Try again.'); }
  }
  return r.asset;
}

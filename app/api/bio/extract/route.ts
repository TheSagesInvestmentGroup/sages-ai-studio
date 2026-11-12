import { ok, fail, withUser, clean } from '@/lib/http';
import { extractFacts } from '@/lib/career';
import { membership } from '@/lib/auth';

export const maxDuration = 60;

async function textOf(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase(), buf = Buffer.from(await file.arrayBuffer());
  if (ext === 'txt') return buf.toString('utf8');
  if (ext === 'docx') { const mammoth = await import('mammoth'); return (await mammoth.extractRawText({ buffer: buf })).value; }
  if (ext === 'pdf') { const { extractText, getDocumentProxy } = await import('unpdf'); const pdf = await getDocumentProxy(new Uint8Array(buf)); const { text } = await extractText(pdf, { mergePages: true }); return Array.isArray(text) ? text.join('\n') : text; }
  throw new Error('type');
}

export const POST = (req: Request) => withUser(req, async user => {
  if (!membership(user).plan?.bio.enabled) return fail(402, 'The Bio & Résumé Studio is not part of your membership.', { needsPlan: true });
  const form = await req.formData().catch(() => null); if (!form) return fail(400, 'Add a résumé file or paste the text.');
  let text = clean(form.get('text'), 20000);
  const file = form.get('file');
  if (file instanceof File && file.size) {
    if (file.size > 4 * 1024 * 1024) return fail(400, 'Résumé files can be up to 4 MB.');
    try { text = (await textOf(file)).slice(0, 20000); } catch { return fail(400, 'We could not read that file. Upload a PDF, DOCX or TXT, or paste the text.'); }
  }
  if (text.replace(/\s/g, '').length < 80) return fail(400, 'There is not enough text to work with. If your PDF is a scan, paste the text instead.');
  const r = await extractFacts(text);
  return ok(r);
}, { member: true, limit: 15 });

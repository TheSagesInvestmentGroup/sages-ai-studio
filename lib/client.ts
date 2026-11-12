'use client';
export class ApiError extends Error { needsPlan = false; status = 0; }

export async function api<T = any>(path: string, method = 'GET', body?: any): Promise<T> {
  const init: RequestInit = { method, headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.body = JSON.stringify(body); (init.headers as any)['Content-Type'] = 'application/json'; }
  let res: Response;
  try { res = await fetch(path, init); } catch { throw new ApiError('You appear to be offline. Check your connection and try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new ApiError(data.error || 'Something went wrong. Try again.'); e.needsPlan = !!data.needsPlan; e.status = res.status; if (res.status === 401) location.href = '/login'; throw e; }
  return data;
}

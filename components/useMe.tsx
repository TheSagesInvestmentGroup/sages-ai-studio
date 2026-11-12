'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';

export interface Me { user: any; member: boolean; plan: any; owner: boolean; demo: boolean; engines: { video: boolean; voice: boolean; writer: boolean; payments: boolean } }
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(() => api('/api/me').then(setMe).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh]);
  return { me, refresh };
}
export function Toast({ text }: { text: string }) { return text ? <div className="toast" role="status">{text}</div> : null; }
export function NeedPlan({ text }: { text?: string }) {
  return <div className="notice row between"><span>{text || 'Choose a membership to start creating.'}</span><a className="btn sm primary" href="/pricing">See memberships</a></div>;
}

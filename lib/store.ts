// Data access. One small interface with two back ends:
//  - Supabase (production): service-role client, used only on the server.
//    Every caller filters by user_id; row-level security in supabase/schema.sql
//    is the second line of defence.
//  - Local JSON file (demo mode): lets the app run with no accounts at all.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cfg, isDemo } from './config';

export type Row = Record<string, any>;
export type Table = 'profiles' | 'projects' | 'characters' | 'assets' | 'tickets' | 'consents' | 'audit_log' | 'credit_ledger' | 'demo_auth';
interface ListOpts { order?: string; asc?: boolean; limit?: number }

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

let _sb: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!_sb) _sb = createClient(cfg.supabaseUrl, cfg.supabaseService, { auth: { persistSession: false, autoRefreshToken: false } });
  return _sb;
}

// ---------- local store ----------
const g = globalThis as any;
function file() {
  let dir = path.join(process.cwd(), '.data');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { dir = path.join(os.tmpdir(), 'sages-ai-studio'); fs.mkdirSync(dir, { recursive: true }); }
  return path.join(dir, 'store.json');
}
function mem(): Record<string, Row[]> {
  if (!g.__sageStore) { try { g.__sageStore = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { g.__sageStore = {}; } }
  return g.__sageStore;
}
const flush = () => { try { fs.writeFileSync(file(), JSON.stringify(mem())); } catch { /* read-only host */ } };
const match = (r: Row, where: Row) => Object.entries(where).every(([k, v]) => r[k] === v);

export const db = {
  async list(table: Table, where: Row = {}, opts: ListOpts = {}): Promise<Row[]> {
    if (isDemo) {
      let rows = (mem()[table] || []).filter(r => match(r, where));
      if (opts.order) rows = [...rows].sort((a, b) => (a[opts.order!] > b[opts.order!] ? 1 : -1) * (opts.asc ? 1 : -1));
      return structuredClone(opts.limit ? rows.slice(0, opts.limit) : rows);
    }
    let q = admin().from(table).select('*').match(where);
    if (opts.order) q = q.order(opts.order, { ascending: !!opts.asc });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },
  async get(table: Table, id: string): Promise<Row | null> {
    if (isDemo) { const r = (mem()[table] || []).find(r => r.id === id); return r ? structuredClone(r) : null; }
    const { data, error } = await admin().from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async insert(table: Table, row: Row): Promise<Row> {
    const full = { id: newId(), created_at: now(), ...row };
    if (isDemo) { (mem()[table] ||= []).push(structuredClone(full)); flush(); return full; }
    const { data, error } = await admin().from(table).insert(full).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },
  async update(table: Table, id: string, patch: Row): Promise<Row | null> {
    if (isDemo) {
      const r = (mem()[table] || []).find(r => r.id === id); if (!r) return null;
      Object.assign(r, structuredClone(patch)); flush(); return structuredClone(r);
    }
    const { data, error } = await admin().from(table).update(patch).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async remove(table: Table, id: string): Promise<void> {
    if (isDemo) { const m = mem(); m[table] = (m[table] || []).filter(r => r.id !== id); flush(); return; }
    const { error } = await admin().from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

/** Row owned by this user, or null. Use for every member-supplied id. */
export async function owned(table: Table, id: string, userId: string) {
  const r = await db.get(table, id);
  return r && r.user_id === userId ? r : null;
}

export async function audit(userId: string | null, action: string, detail: Row = {}) {
  try { await db.insert('audit_log', { user_id: userId, action, detail }); } catch { /* never block on logging */ }
}

-- The Sages AI Studio: database schema for Supabase (Postgres).
-- Run once in the Supabase SQL editor. Safe to re-run.
-- The app's server uses the service-role key and filters by user_id in code.
-- Row-level security below is the second line of defence: even with the public
-- anon key, a signed-in member can read only their own rows and write nothing.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, name text, interests jsonb not null default '[]',
  tier text, status text not null default 'none', credits integer not null default 0 check (credits >= 0),
  videos_used integer not null default 0, period_end timestamptz, onboarded boolean not null default false,
  role text not null default 'member', stripe_customer_id text unique, stripe_subscription_id text, last_event text,
  created_at timestamptz not null default now()
);
create table if not exists projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'production', title text, prompt text, style text, duration integer, aspect text, category text, mode text,
  folder text, episode integer, cast_ids jsonb not null default '[]', use_brand boolean not null default false,
  status text not null default 'concept', treatments jsonb, treatment_source text, chosen text, plan jsonb, plan_source text,
  chat jsonb not null default '[]', versions jsonb not null default '[]', portfolio jsonb,
  shared boolean not null default false, share_slug text unique, counted boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists projects_user on projects(user_id, updated_at desc);
create table if not exists characters (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  name text not null, appearance text, wardrobe text, personality text, voice text, relationships text, backstory text,
  real_person boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz
);
create table if not exists assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  name text not null, kind text, role text, note text, size bigint, mime text, path text, ready boolean not null default false,
  visibility text not null default 'private', created_at timestamptz not null default now()
);
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  email text, name text, subject text, status text not null default 'open', messages jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists consents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  kind text not null, subject text, statement text not null, ref text, created_at timestamptz not null default now()
);
create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
  amount integer not null, reason text not null, ref jsonb, created_at timestamptz not null default now()
);
create index if not exists ledger_user on credit_ledger(user_id, created_at desc);
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(), user_id uuid, action text not null, detail jsonb, created_at timestamptz not null default now()
);

-- Atomic credit spend: never lets a balance go below zero, even with simultaneous renders.
create or replace function spend_credits(p_user uuid, p_amount integer) returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean; begin
  update profiles set credits = credits - p_amount where id = p_user and credits >= p_amount returning true into ok;
  return coalesce(ok, false);
end $$;
create or replace function add_credits(p_user uuid, p_amount integer) returns void language sql security definer set search_path = public as $$
  update profiles set credits = greatest(0, credits + p_amount) where id = p_user;
$$;
revoke all on function spend_credits(uuid, integer) from public, anon, authenticated;
revoke all on function add_credits(uuid, integer) from public, anon, authenticated;

-- Row-level security: members may read their own rows. All writes go through the server.
do $$ declare t text; begin
  foreach t in array array['projects','characters','assets','tickets','consents','credit_ledger'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_read on %I', t);
    execute format('create policy own_read on %I for select using (auth.uid() = user_id)', t);
  end loop;
end $$;
alter table profiles enable row level security;
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for select using (auth.uid() = id);
alter table audit_log enable row level security; -- no policies: server only

-- Storage. "assets" is private (member uploads, served through short-lived signed links).
-- "renders" holds finished clips and narration at unguessable paths so shared productions can play.
insert into storage.buckets (id, name, public, file_size_limit) values ('assets', 'assets', false, 419430400) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('renders', 'renders', true) on conflict (id) do nothing;

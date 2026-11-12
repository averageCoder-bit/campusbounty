-- Run in Supabase SQL Editor. All client-visible tables have RLS enabled.
-- FastAPI connects via a trusted backend Postgres connection; DO NOT expose DATABASE_URL.
create extension if not exists pgcrypto;

create table if not exists public.cb_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  coins bigint not null default 0 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cb_lesson_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  attempts int not null default 0 check (attempts >= 0),
  best_score int not null default 0 check (best_score >= 0),
  mastered boolean not null default false,
  last_practiced_at timestamptz not null default now(),
  first_mastered_at timestamptz,
  primary key(user_id, lesson_id)
);

create table if not exists public.cb_academy_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  manifest_version text not null,
  question_order jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz
);
create index if not exists cb_academy_attempts_user_idx on public.cb_academy_attempts(user_id, created_at desc);

create table if not exists public.cb_reward_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,
  source text not null,
  xp int not null check (xp >= 0),
  coins int not null check (coins >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, reward_key)
);

create table if not exists public.cb_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  awarded_at timestamptz not null default now(),
  primary key(user_id, achievement_id)
);

create table if not exists public.cb_review_mistakes (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  mistakes int not null default 1 check (mistakes > 0),
  updated_at timestamptz not null default now(),
  primary key(user_id, question_id)
);

-- Client-reported runs are historical telemetry only, never proof of completion.
create table if not exists public.cb_adventure_runs (
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('quest-finding','dungeon-conquer')),
  seed bigint not null check(seed >= 0 and seed < 4294967296),
  outcome text not null check (outcome in ('cleared','failed','abandoned')),
  duration_seconds integer not null check(duration_seconds between 0 and 14400),
  verification_status text not null default 'client_reported'
     check(verification_status = 'client_reported'),
  created_at timestamptz not null default now(),
  primary key (user_id, run_id)
);
create index if not exists cb_adventure_runs_recent_idx
  on public.cb_adventure_runs(user_id, created_at desc);

-- Tables are addressable through Supabase's Data API unless RLS blocks actions.
-- Only allow authenticated users to SELECT their own rows. No browser insert/update/delete policies.
do $$
declare name text;
begin
  foreach name in array array['cb_profiles','cb_lesson_mastery','cb_academy_attempts',
                              'cb_reward_ledger','cb_achievements','cb_review_mistakes','cb_adventure_runs'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('drop policy if exists "Read own records" on public.%I', name);
    if name <> 'cb_academy_attempts' then
      execute format('create policy "Read own records" on public.%I for select to authenticated using (user_id = (select auth.uid()))', name);
    end if;
  end loop;
end $$;

-- NOTE: The API database connection must be a trusted role capable of writing these tables.
-- Never put Postgres credentials, service_role/secret keys, or any migration SQL in VITE_* env vars.

-- No browser SELECT or write policies for cb_academy_attempts: its private answer permutation stays backend-only.

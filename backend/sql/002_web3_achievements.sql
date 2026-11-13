-- Run AFTER backend/sql/001_unified_progression.sql in Supabase SQL Editor.
-- No browser writes. All modifications are made from authenticated FastAPI using a trusted DB role.
create extension if not exists pgcrypto;

create table if not exists public.cb_wallet_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null check(wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists cb_wallet_challenges_user_idx on public.cb_wallet_challenges(user_id, created_at desc);

create table if not exists public.cb_wallet_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null unique check(wallet_address ~ '^0x[0-9a-f]{40}$'),
  linked_at timestamptz not null default now()
);

create table if not exists public.cb_web3_issuances (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  wallet_address text not null,
  proof_hash text not null,
  tx_hash text,
  status text not null check(status in ('submitted','confirmed','failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  primary key(user_id, achievement_id)
);
create unique index if not exists cb_web3_issuances_tx_unique on public.cb_web3_issuances(tx_hash) where tx_hash is not null;

alter table public.cb_wallet_challenges enable row level security;
alter table public.cb_wallet_connections enable row level security;
alter table public.cb_web3_issuances enable row level security;
-- No browser-side insert/update/delete policies. No browser access to replayable challenges.
drop policy if exists "Read own wallet" on public.cb_wallet_connections;
create policy "Read own wallet" on public.cb_wallet_connections for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists "Read own onchain claims" on public.cb_web3_issuances;
create policy "Read own onchain claims" on public.cb_web3_issuances for select to authenticated
using (user_id = (select auth.uid()));

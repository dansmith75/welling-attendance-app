-- Matchday resilience support
-- Run once in Supabase SQL Editor.
-- Live autosaves are kept separate from completed matchday_sessions so Excel
-- can never mistake a recovery snapshot for a finished match.

create table if not exists public.matchday_recovery (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  season text not null,
  match_id text,
  match_date date,
  opposition text,
  submitted_by text,
  started_at timestamptz,
  saved_at timestamptz not null default now(),
  reason text,
  match_seconds integer,
  payload jsonb not null
);

create index if not exists idx_matchday_recovery_match_id
  on public.matchday_recovery (match_id);

alter table public.matchday_recovery enable row level security;

drop policy if exists "Allow anon insert matchday recovery" on public.matchday_recovery;
create policy "Allow anon insert matchday recovery"
  on public.matchday_recovery for insert to anon with check (true);

drop policy if exists "Allow anon update matchday recovery" on public.matchday_recovery;
create policy "Allow anon update matchday recovery"
  on public.matchday_recovery for update to anon using (true) with check (true);

drop policy if exists "Allow anon read matchday recovery" on public.matchday_recovery;
create policy "Allow anon read matchday recovery"
  on public.matchday_recovery for select to anon using (true);

drop policy if exists "Allow anon delete matchday recovery" on public.matchday_recovery;
create policy "Allow anon delete matchday recovery"
  on public.matchday_recovery for delete to anon using (true);

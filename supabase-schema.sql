-- Welling United Red OBDSFL Attendance App v2 schema
-- Run this in Supabase SQL Editor.

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  team text not null,
  season text not null,
  session_date date not null,
  session_type text not null check (session_type in ('Training', 'Match')),
  venue text check (venue in ('Home', 'Away')),
  submitted_by text,
  submitted_at timestamptz not null default now(),
  source text not null default 'welling_attendance_app',
  payload jsonb not null
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  player_id text not null,
  display_name text not null,
  status text not null,
  fee_paid boolean,
  payment_status text,
  late_payment boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_sessions_date
  on public.attendance_sessions (session_date desc);

create index if not exists idx_attendance_records_session_id
  on public.attendance_records (session_id);

create index if not exists idx_attendance_records_player_id
  on public.attendance_records (player_id);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

-- MVP browser app policy:
-- Allows the GitHub Pages app to insert new sessions and records using the anon/publishable key.
-- Does not allow public reads yet. We can add read policies later for the dashboard.

drop policy if exists "Allow anon insert attendance sessions" on public.attendance_sessions;
create policy "Allow anon insert attendance sessions"
  on public.attendance_sessions
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon insert attendance records" on public.attendance_records;
create policy "Allow anon insert attendance records"
  on public.attendance_records
  for insert
  to anon
  with check (true);

-- Later dashboard read option, if needed:
-- create policy "Allow anon read attendance sessions"
--   on public.attendance_sessions
--   for select
--   to anon
--   using (true);
--
-- create policy "Allow anon read attendance records"
--   on public.attendance_records
--   for select
--   to anon
--   using (true);


-- v2.2 recent sessions view policies
-- These allow the app to read recent submitted sessions and player records.
drop policy if exists "allow_select_attendance_sessions" on public.attendance_sessions;
drop policy if exists "allow_select_attendance_records" on public.attendance_records;

create policy "allow_select_attendance_sessions"
on public.attendance_sessions
as permissive
for select
to anon
using (true);

create policy "allow_select_attendance_records"
on public.attendance_records
as permissive
for select
to anon
using (true);


-- v2.4: add the user who submitted the session if the table already exists.
alter table public.attendance_sessions
add column if not exists submitted_by text;

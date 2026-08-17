-- Welling Matchday -> Excel reconciliation support
-- Run this once in Supabase SQL Editor.
--
-- Matchday submissions are already written to public.matchday_sessions.
-- The local UPDATE-WELLING tool uses the same public publishable/anon key as
-- the Attendance app and needs SELECT access so completed Matchdays submitted
-- by any manager/device can be reconciled into the master Excel workbook.

alter table public.matchday_sessions enable row level security;

drop policy if exists "allow_select_matchday_sessions" on public.matchday_sessions;
create policy "allow_select_matchday_sessions"
on public.matchday_sessions
as permissive
for select
to anon
using (true);

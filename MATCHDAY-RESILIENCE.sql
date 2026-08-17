-- Matchday resilience support
-- Run once in Supabase SQL Editor.
-- Allows the app to update the same Matchday row during live autosaves
-- and convert that row into the final completed match at Full Time.

alter table public.matchday_sessions enable row level security;

drop policy if exists "Allow anon update matchday sessions" on public.matchday_sessions;
create policy "Allow anon update matchday sessions"
  on public.matchday_sessions
  for update
  to anon
  using (true)
  with check (true);

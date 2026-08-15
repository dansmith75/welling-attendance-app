-- Welling United Red OBDSFL - clean start for 2026/27
-- Run this once in Supabase > SQL Editor.
-- attendance_records are removed automatically because the FK uses ON DELETE CASCADE.

delete from public.attendance_sessions;

select count(*) as sessions_remaining from public.attendance_sessions;
select count(*) as records_remaining from public.attendance_records;

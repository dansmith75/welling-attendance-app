# Welling United Red OBDSFL Attendance App v2

Simple mobile-first attendance app for Welling United Red OBDSFL.

## v2 adds

- Supabase save on Submit
- Local browser save while marking attendance
- JSON download fallback if Supabase is not configured or submit fails
- Home match unpaid warning before submit

## Setup

1. Run `supabase-schema.sql` in Supabase SQL Editor.
2. Copy your Supabase Project URL and anon/publishable key into `supabase-config.js`.
3. Commit and push the files.
4. Test from GitHub Pages.

Never put the Supabase `service_role` key into this browser app.

Deployment retry 2026-07-02 16:27

# Welling United Red Attendance App

Mobile-first Attendance and Matchday capture for Welling United Red OBDSFL.

## Current data flow

The app writes Attendance and completed Matchday data to Supabase so any authorised manager can run the session from their own phone.

The master Excel workbook remains the football-data source of truth.

Normal workflow:

1. Manager records Attendance and/or Matchday in the app.
2. The app submits the data centrally to Supabase.
3. `UPDATE-WELLING` runs `sync_supabase_to_excel.py` and imports only new Supabase submissions into Excel.
4. Excel is saved.
5. The Dashboard JSON files are regenerated from Excel.
6. The changed JSON is published to GitHub.
7. Dashboard, Attendance and Matchday continue to use the shared squad and fixture feeds.

There is no manual Excel CSV export/import step in the normal workflow.

## Attendance

- Training statuses: Present, Late, Absent, Injured.
- Match statuses: Present, Late, No Show, Unavailable, Injured, Rotated.
- Match squad is limited to 16 players marked Present or Late.
- Unavailable, Injured and Rotated players move to the bottom of the list.
- Active players and `displayName` come from the shared Dashboard `players.json` feed.
- Submitted Attendance is stored centrally in Supabase.
- Recent submitted sessions can be reviewed from the app.

## Matchday v3

- Matchday squad is automatic from players marked Present or Late on Match Attendance.
- Starting lineup is selected by tapping player cards; maximum 11, with fewer allowed after confirmation.
- A player changed to Late after kick-off can join the live Matchday squad, up to the 16-player squad limit.
- Players on pitch are shown together but clustered by position group: goalkeeper, defence, midfield, attack.
- Start, Pause / Half Time, Resume and Full Time match clock.
- Pause / Half Time uses the orange treatment; Full Time is green; Cancel Matchday is isolated at the bottom.
- Substitutions record player off, player on and minute, with minutes played recalculated from substitution history.
- Recorded substitutions and events use the spanner control for Edit / Delete / Cancel.
- Match events support goals, own goals, yellow cards, red cards, sin bins and free-text player events.
- Goal types support Open Play, Penalty, Free Kick and Corner.
- Open Play, Free Kick and Corner can record an assist; Penalty does not.
- Own Goal is recorded without attributing the goal to one of our players.
- Live Matchday state is stored locally for immediate recovery and periodically backed up to Supabase.
- A safety stop protects forgotten running matches at 180 minutes.
- Completed Matchdays are stored centrally in Supabase `matchday_sessions`.

## Supabase to Excel

`UPDATE-WELLING` pulls central submissions back into Excel automatically.

Attendance records are appended only when their generated record key has not already been imported.

Completed Matchdays are imported once by Supabase session ID. The Matchday audit table retains starters, substitutions, minutes, goals, assists, cards and notes while the existing Goals, Assists and Events sheets are updated where applicable.

This means the phone used to run the session is not part of the long-term data chain once the Supabase submission succeeds.

## Shared data

`app-config.js` points Attendance / Matchday at the Dashboard-published:

- `data/players.json`
- `data/matches.json`

Excel remains the editable squad / fixture source. The Dashboard exporter publishes those changes for both sites.

## Setup notes

Keep the existing `supabase-config.js` when upgrading so the real Supabase URL, publishable key and admin PIN are preserved.

The Supabase project uses:

- `attendance_sessions`
- `attendance_records`
- `matchday_sessions`
- `matchday_recovery`

The Matchday recovery table is created by `MATCHDAY-RESILIENCE.sql`.

Deployment refresh: 2026-08-18.

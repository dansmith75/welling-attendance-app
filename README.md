# Welling United Red Attendance App v2.5

Mobile-first attendance capture app for Welling United Red OBDSFL.

## v2.5

Adds an admin-only Excel-ready CSV export from Supabase.

The CSV is a flat table designed to be imported into the Excel workbook as an `AttendanceRecords` table.

Columns exported:

- RecordKey
- SessionKey
- SessionId
- SessionDate
- SessionType
- Venue
- PlayerId
- DisplayName
- Status
- FeePaid
- PaymentStatus
- LatePayment
- SubmittedBy
- SubmittedAt
- Source

Excel remains the editable source of truth after import. Supabase remains the pitch-side capture database.

## Notes

Keep your existing `supabase-config.js` when upgrading so your real Supabase URL, key and admin PIN are preserved.


## v3
- Payment tracking removed; the fixed monthly fee is managed in Excel.
- Player list contains active players only.
- User-facing player names use `displayName`; IDs are internal only.
- Run `RESET-TEST-DATA.sql` once in Supabase to clear test sessions.


## Matchday Mode v1
- Fixture selection from `matches.json`.
- Squad selection (max 16) and Starting XI (exactly 11).
- Start/pause/resume/full-time match clock.
- Substitution tracking with editable minute entry and rolling substitutions supported.
- Automatic minutes played calculation.
- Finished Matchday saved to Supabase `matchday_sessions` with JSON backup on failure.
- Run `MATCHDAY-V1-SCHEMA.sql` once before first use.


## Matchday v1.2 UI changes
- Matchday now uses the same red header / white card visual language as Attendance.
- Attendance status buttons are neutral until selected; selected status supplies the colour.
- Manual Home/Away selection removed from Attendance. Matchday works from the selected fixture.
- Matchday launch button moved into the Session Type card under Training/Match.


## Matchday v1.3
- Matchday button sits directly below Session Type and appears only when Match is selected.
- Starting XI chooser only shows players selected in the Matchday squad.


## Matchday v1.4
- Matchday squad is automatic from the current Match attendance screen.
- `Present` and `Late` players are included in the squad; all other statuses are excluded.
- Matchday only asks for the starting lineup.
- Eleven starters is the normal target, but fewer starters are allowed after a confirmation warning.
- Fixture loading supports a shared Dashboard `matches.json` URL through `app-config.js`, with local `matches.json` fallback.


## Matchday v1.5
- Match attendance is limited to 16 players marked Present/Late.
- Players marked Unavailable, Injured or Rotated move to the bottom of the Attendance list.
- A player changed to Late after kick-off is automatically added to the live Matchday squad/bench.
- Matchday can record goals with scorer and Open Play/Penalty type.
- Matchday can record Yellow, Red and Sin Bin events.
- Match events are stored inside the existing Matchday Supabase JSON payload.


## Matchday v1.6
- Open Play goals now have an optional Assist dropdown.
- Assist options come from the current Matchday squad and exclude the scorer.
- Selecting Penalty hides and clears the Assist field.
- Goal events store `goalType`, scorer, minute and `assistPlayerId` when applicable.

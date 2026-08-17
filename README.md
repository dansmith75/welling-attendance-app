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

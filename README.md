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

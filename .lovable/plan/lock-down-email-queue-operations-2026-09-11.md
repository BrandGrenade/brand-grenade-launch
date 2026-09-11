# Lock down email queue operations

## Changes
- Revoke execution from anonymous, signed-in, and general public access on the four queue-management functions.
- Apply the same restriction to `email_queue_dispatch()` unless live code/schema evidence identifies a required public caller.
- Preserve service-role execution so existing server-side email processing continues.
- Record `repository_visitors.plaintext_password` as a separate security follow-up without changing it now.

## Verification
- Query the live database grants before and after the migration for all five functions.
- Run the database security scanner after the migration and report the exact remaining findings relevant to these functions.
- Confirm the email-processing route still calls these operations only through the privileged server path.

## Technical details
- Use a database migration with explicit `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and `GRANT EXECUTE ... TO service_role` statements.
- Do not alter the five deny-all tables, session-access helpers, or trigger functions.

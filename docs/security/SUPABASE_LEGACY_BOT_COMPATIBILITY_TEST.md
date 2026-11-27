# Supabase legacy bot compatibility test

This is an opt-in integration smoke test for the legacy Supabase service-role fallback. It is designed to run only against a disposable Supabase development branch after migrations `0005_delivery_qa.sql` and `0006_lock_legacy_supabase_data_api.sql` have been applied there.

## Required environment

Set these variables to values belonging to the isolated branch:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_SERVICE_KEY` (server-side secret/service-role key)
- `SUPABASE_TEST_PROJECT_REF` (branch project ref)

The script refuses the known production project ref `aebdqztoolszdzfbdlbp` and checks that the URL hostname matches the supplied test project ref. It does not read ordinary production bot secrets.

## Run

```bash
npm run test:supabase:legacy-bots
```

The smoke test exercises the service-role operations used by the legacy bot layer:

| Bot/data path | Operations exercised |
| --- | --- |
| Generic bot DB helper | SELECT, INSERT, UPDATE, DELETE cleanup |
| Lead workflows | Read and insert/update `leads` |
| Operations manager | Read and insert `clients`, `orders`, `activity_log`, `delivery_status` |
| Error handler | Read and update `delivery_status` |
| Agent memory | Read and upsert `agent_memory` |

It creates uniquely named disposable records and removes them in a `finally` cleanup. It does not test the Hume Storage bucket; that is a separate Storage API workflow and is not affected by the table-grant migration.

## What this does not prove

A successful run proves the tested service-role CRUD paths work on that isolated branch. It does not prove that the migration is safe for production or that anonymous/authenticated user flows are preserved. The SQL contract test in `supabase/tests/0006_lock_legacy_supabase_data_api.sql` separately asserts the role grants and RLS state. The dashboard's current same-origin Neon API path must also remain covered by the normal app CI.

Do not run this script with production credentials. Do not apply migrations to production as part of this test.

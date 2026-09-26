# Production migration reconciliation: 2026-09-25

```text
STATUS=BLOCKED_NO_AUTHORIZED_READ_ONLY_DATABASE_ACCESS
LOCAL_MIGRATION_COUNT=121
REMOTE_MIGRATION_COUNT=UNKNOWN
REMOTE_MIGRATION_HISTORY=UNKNOWN
SCHEMA_DRIFT=UNKNOWN
REMOTE_SQL_EXECUTED=NO
DB_PUSH=NO
MIGRATION_REPAIR=NO
```

## Evidence

The local migration directory contains 121 timestamped SQL migrations at the
current qualification branch. Local migration rebuild/schema validation passed
in the preceding full-local gate, but it is not evidence of production parity.
The public REST probe returned HTTP 200 with a zero-row query under the anon
role; this reveals neither migration history nor schema metadata.

At the V2 checkpoint, the process environment had no
`READ_ONLY_DATABASE_URL`, `PGHOST`, `PGUSER`, `PGDATABASE`, or `PGPASSWORD`.
No authorized SSH configuration was present, and no VPS connection was
attempted. Therefore no production schema inventory or migration history was
read. No object can truthfully be classified as applied, missing, extra, drift,
legacy, or dangerous from the evidence available.

## Required read-only reconciliation

After an operator provisions an authorized least-privilege connection, capture
the output of `scripts/db/self-hosted-production-inventory.sql` outside Git and
compare it with the checked-out migrations. Do not export table rows or PII.
Compare migration identifiers/order independently from object metadata, then
classify each observed difference before proposing any change. Any write,
repair, or migration application remains a separate human-approved operation
with a backup and restore rehearsal gate.

```text
NEXT_REQUIRED=AUTHORIZED_READ_ONLY_DATABASE_URL_OR_APPROVED_VPS_ACCESS
PROPOSED_PRODUCTION_MUTATION=NONE
```

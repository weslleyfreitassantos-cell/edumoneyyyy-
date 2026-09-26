# TecEscola Production Qualification

```text
CAMPAIGN=TECESCOLA_PRODUCTION_QUALIFICATION
REPOSITORY=weslleyfreitassantos-cell/edumoneyyyy-
EXPECTED_BASE=e550ad575f9d06e67f7b91d54501c3ed4216dbc7
ACTUAL_BASE=e550ad575f9d06e67f7b91d54501c3ed4216dbc7
BRANCH=release/tecescola-production-qualification
FINAL_HEAD=recorded by the PR #224 head ref
```

This report separates reproducible local evidence from production facts that
could not be verified without authorized VPS access. A green local suite does
not certify the current production database or external providers.

## Graphify

```text
GRAPHIFY_BASELINE=PASS
GRAPHIFY_FINAL=PASS
BASELINE=5851 nodes / 12831 edges / 372 communities / 697 code files
FINAL=6518 nodes / 13501 edges / 439 communities / 708 code files
```

The final AST pass re-extracted 547 previously uncached code files and 10
changed/new code files. The graph delta is a broad structural refresh and is
not attributable only to this campaign. The top hubs remain framework/test and
auth/context nodes. One tracked parser warning remains at
`src/components/auth/AuthLayout.HEAD.tsx:1`; TypeScript typecheck passes.
Generated graph artifacts are ignored and fingerprinted in
`docs/architecture/graphify-final.md`.

## Local Gates

```text
NPM_CI=PASS (completed before final gate)
TYPECHECK=PASS
UNIT_TESTS=PASS (251 files, 1585 tests)
BUILD=PASS
DB_RESET_LOCAL=PASS
DB_LINT=PASS (0 errors; 5 existing warnings in 3 functions)
SCHEMA_DRIFT=PASS (no changes in public schema)
READ_ONLY_INVENTORY_SQL_LOCAL=PASS (executed inside isolated Supabase Postgres)
MIGRATION_TESTS=PASS (64 files, 249 tests)
DATABASE_TESTS=PASS (16 files, 65 tests)
EDGE_FUNCTION_TESTS=PASS (19 files, 147 tests)
EDGE_FUNCTION_CHECK=PASS (10 functions)
EDGE_FUNCTION_LINT=PASS (10 functions)
FULL_LOCAL=PASS
FULL_LOCAL_SECONDS=1234.5
PLAYWRIGHT_ACADEMIC=PASS (12/12)
PLAYWRIGHT_CROSS_TENANT=PASS (covered by academic flow and DB runtime suite)
PLAYWRIGHT_RESTART_PERSISTENCE=PASS (1/1)
```

The browser flow covered DIRECTOR, SECRETARY, TEACHER, STUDENT, GUARDIAN,
ADMIN, and a second institution. It recorded zero unexpected 4xx, 5xx,
request failures, or console errors. Four `send-school-email` HTTP 503 responses
were expected because no local email provider credentials were configured;
this verifies failure handling, not delivery.

`npm run check` was not repeated as a wrapper because its constituent
typecheck, complete unit suite, and build were each run successfully inside the
final full-local gate. `git diff --check` passed; Git emitted only its
configured LF-to-CRLF working-copy notices.

## Security

```text
XLSX_SECURITY=PASS
XLSX_VERSION=0.20.3 official SheetJS CDN tarball
XLSX_FORMULA_HTML_PARSING=DISABLED
XLSX_REGRESSIONS=PASS (.xls/.xlsx support and published ReDoS input)
NPM_AUDIT=PASS (0 vulnerabilities)
NPM_AUDIT_PRODUCTION=PASS (0 vulnerabilities)
GITLEAKS_GIT_HISTORY=PASS (0 findings)
```

The worktree-only Gitleaks scan also read ignored local Supabase-generated
secrets and Graphify cache artifacts, plus a deterministic synthetic seed in
`supabase/test-data/aurora-integral-demo.sql`; none is a production credential.
The local generated files are ignored and are not part of the PR. Staged-diff
secret scanning is recorded after staging.

## Production Observations

Only public GET probes were made against `https://tecescola.grupotec.dev.br`
and `https://api-edu-vps.grupotec.dev.br`. The public key was kept in process
memory and not printed or persisted.

```text
FRONTEND=HTTP 200
AUTH_HEALTH=HTTP 200
POSTGREST_LIMIT_ZERO=HTTP 200; zero rows visible to anon (database emptiness not inferred)
STORAGE_API=HTTP 200; empty anon response does not prove there are no private buckets
REALTIME_PING=HTTP 503
REST_OPENAPI_ROOT=HTTP 403 (table endpoint independently responded 200)
HEALTH_CHECK=FAIL (Realtime 503)
```

No SQL-privileged production connection or SSH session was available or
attempted. No authorized SSH username, read-only DB URL, production backup
location, `age` recipient, dedicated pilot tenant, role credentials, or SMTP
test configuration was supplied in this environment. No customer credentials
were used. No remote database or deployment mutation was performed.

```text
PRODUCTION_DB_AUDIT=BLOCKED
PRODUCTION_SCHEMA_RECONCILED=BLOCKED
BACKUP=BLOCKED (no authorized production dump access or destination/recipient)
BACKUP_SHA256=N/A
RESTORE_TEST=BLOCKED (no production backup to restore)
PLAYWRIGHT_PRODUCTION_SMOKE=BLOCKED (no dedicated pilot tenant/credentials)
AUTH_LOGIN_PRODUCTION=BLOCKED (no pilot identities)
AUTH_INVITES=BLOCKED (no real SMTP/provider credentials)
AUTH_PASSWORD_RECOVERY=BLOCKED (email/token delivery not configured for proof)
SMTP=BLOCKED
ROLLBACK_PLAN=PASS_DOCUMENTED (not rehearsed against the VPS)
OBSERVABILITY=PARTIAL (safe HTTP health probes and VPS read-only script exist; production logs unavailable)
```

The public Realtime 503 is a confirmed service issue, not an inference. It
requires inspection of the VPS Realtime container and reverse-proxy logs by an
authorized operator. No container name or Compose topology was guessed.

## External Blocker Closure Checkpoint

```text
START_BRANCH=release/tecescola-production-qualification
START_HEAD=788bb7b1e3982c62b5014110d58efe3bbc936f11
MAIN_HEAD=e550ad575f9d06e67f7b91d54501c3ed4216dbc7
PR=224
PR_STATE=OPEN
PR_MERGEABLE=YES
MERGED=NO
LOCAL_MIGRATION_COUNT=121
REMOTE_MIGRATION_COUNT=UNKNOWN
```

At `2026-09-25T20:49:05.778Z`, the production health script was rerun with the
publishable client key obtained transiently from the public frontend bundle;
the key was neither printed nor stored. Frontend/Auth/REST/Storage returned
200 (72/126/133/127 ms); Realtime returned 503 (120 ms). A second GET at
`2026-09-25T20:48:25.620Z` returned 503 in 197 ms and exposed only
`via: 1.1 Caddy` and `content-type: text/plain` among the allowlisted headers.
This confirms that Caddy is in the observed request path but does not prove
whether Caddy or its upstream generated the response. An unauthenticated ping
returned 401 and is not counted as a health result. No response body was
recorded.

No direct application subscription usage (`supabase.channel`, `postgres_changes`,
presence, or broadcast) was found in application source; Realtime client
references were limited to dependency lockfiles. The 503 remains an
infrastructure health failure and is not waived by this source search.

The required Docker inventory was read-only. Docker 29.7.2 / Compose 5.4.0
showed one running, protected container from the parallel OmniHub campaign
(about 36 MiB of 1 GiB at the snapshot); no TecEscola/Supabase container was
running. Existing containers, networks, and volumes were not stopped, removed,
or modified; this campaign created no Docker resources. The sanitized snapshot
is retained locally at `artifacts/production-closure/docker-before.json` and
is intentionally untracked because it includes an unrelated protected
container identity.

No authorized VPS SSH configuration was present (`~/.ssh/config` absent), so
no connection was attempted. Production DB, backup/restore, SMTP, and pilot
prerequisite environment variables were unset. Therefore no privileged DB
inventory, production backup, restore, SMTP delivery, or production Playwright
was attempted. The remote migration count and schema parity remain unknown.

```text
READ_ONLY_PHASE_COMPLETE=YES (available public/local checks only)
VPS_ACCESS=BLOCKED_NO_AUTHORIZED_VPS_ACCESS
VPS_TOPOLOGY_CONFIRMED=NO
REALTIME_ROOT_CAUSE=UNKNOWN (public request traverses Caddy; upstream unverified)
REALTIME_FIX_REQUIRED=YES
REALTIME_FIX_APPLIED=NO
REALTIME_AFTER=HTTP 503
PRODUCTION_DB_AUDIT=BLOCKED_NO_AUTHORIZED_READ_ONLY_CONNECTION
BACKUP=BLOCKED_NO_ENCRYPTED_DESTINATION_OR_AUTHORIZED_SOURCE
RESTORE_TEST=BLOCKED_NO_PRODUCTION_BACKUP
SMTP=BLOCKED_NO_PROVIDER_CREDENTIALS_AND_TEST_MAILBOX
PILOT_TENANT=BLOCKED_NOT_CONFIRMED
PLAYWRIGHT_PRODUCTION_SMOKE=BLOCKED_NO_PILOT_IDENTITIES
PRODUCTION_MUTATIONS_PERFORMED=NONE
MUTATIONS_APPROVED_BY_HUMAN=NONE
PARALLEL_OMNIHUB_CAMPAIGN_DETECTED=YES
PARALLEL_OMNIHUB_CONTAINERS_TOUCHED=NO
DOCKER_EXISTING_CONTAINERS_PROTECTED=YES
TECESCOLA_LOCAL_DOCKER_INTERRUPTED=NO
FOREIGN_CONTAINERS_INTERRUPTED=NO
```

The next production step requires an authorized VPS operator to provide the
confirmed SSH identity/topology and perform a bounded, redacted read-only
inspection of the Caddy route and Realtime service logs. Any proposed restart,
proxy/Compose edit, secret change, database write, invite, or deployment must
first pass the campaign's human mutation gate. No specific production mutation
is proposed while the root cause is unknown.

## Operational Follow-up

After receiving an authorized read-only database connection, capture inventory
to protected storage (never commit the output):

```sh
psql "$READ_ONLY_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -f scripts/db/self-hosted-production-inventory.sql \
  > /secure/audit/tecescola-production-inventory.txt
```

Then provision an encrypted backup destination and `age` recipient outside
the VPS, run `ops/backup/backup-postgres.sh`, verify the archive with
`ops/backup/verify-postgres-backup.sh`, and restore it only to a disposable
loopback Supabase/Postgres instance using
`ops/restore/restore-test-postgres.sh`. For Storage bytes, use the separate
`rclone copy`/`rclone check` scripts; a SQL dump does not include object bytes.

For production browser smoke, first designate a tenant explicitly for
homologation and create non-customer accounts for the required roles. Supply
credentials through an ephemeral secret environment and execute
`npm run e2e:production-smoke`; the test configuration rejects non-HTTPS URLs
and requires explicit pilot confirmation. Screenshots, traces, and videos are
disabled so credentials are not retained. The smoke was only listed, not run.

An authorized VPS operator must inspect the Realtime service and proxy logs
with a bounded time window and redact tokens, e-mails, and student data. The
existing `ops/health/vps-readonly.sh` captures host/container health only; it
does not restart services or inspect unknown Compose configuration.

## Documentation and Maturity

```text
DOCUMENTATION_RECONCILED=PASS
CURRENT_STATE=docs/CURRENT_STATE.md
PRODUCTION_SNAPSHOT=docs/production/current-production-state.md
SELF_HOSTED_RUNBOOK=docs/operations/self-hosted-production-runbook.md
```

Legacy Cloud-era database, role, readiness, invite, and staging documents are
classified at their top and in `documentation-reconciliation.md`. Current
code/migrations describe the versioned role model; they are not evidence of
production parity.

```text
FINANCE=EXPERIMENTAL (mock/manual payment path; no real gateway qualified)
CAMERAS=INTEGRATION_REQUIRED (physical device/network flow not qualified)
PORTARIA=INTEGRATION_REQUIRED (live device ingestion not qualified)
```

## External Blockers and Readiness

```text
EXTERNAL_BLOCKERS=5
1. Authorized SSH/read-only PostgreSQL access and confirmed VPS topology.
2. Encrypted production backup target/recipient and disposable restore target.
3. Dedicated non-customer pilot tenant and role test identities.
4. Real SMTP/provider credentials for invite and password-recovery delivery.
5. Realtime HTTP 503 diagnosis/fix by an authorized VPS operator.
PILOT_READINESS=NOT_READY
```

The local application, clean migration rebuild, RLS/runtime suites, browser
workflow, and persistence gate passed. Controlled production/pilot readiness
remains blocked by the concrete external items above; no remote state was
changed to make the report appear green.

```text
PR=https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/224
PR_STATE=OPEN
MERGED=NO
```

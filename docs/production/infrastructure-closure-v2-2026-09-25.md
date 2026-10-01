# TecEscola production infrastructure closure — V2 checkpoint

**Checkpoint:** 2026-09-26T00:29:36.360Z (UTC)

**Campaign:** `TECESCOLA_PRODUCTION_INFRASTRUCTURE_CLOSURE_V2`

**Repository:** `weslleyfreitassantos-cell/edumoneyyyy-`

This is an evidence checkpoint, not a production readiness approval. Public
health and local Docker inventory were read-only. No authorized VPS or
production database access was available, so no internal topology or database
claims are inferred from the public probes.

## Evidence

| Probe | Timestamp (UTC) | Result |
|---|---|---|
| Production health matrix | 2026-09-26T00:29:36.360Z | Frontend 200 / 485 ms; Auth 200 / 525 ms; REST 200 / 952 ms; Storage 200 / 1311 ms; Realtime 503 / 963 ms |
| Public DNS and TLS | 2026-09-26T00:29:36.360Z capture | Site and API DNS resolved; frontend/API certificates TLS-authorized; frontend cert valid through 2026-11-02, API cert through 2026-12-18 |
| Realtime response path | Same capture | HTTP 503 with allowlisted `via: 1.1 Caddy`; proves Caddy is in the path, not whether Caddy or upstream generated 503 |
| Local Docker inventory | 2026-09-25T22:39:44.805Z | Docker 29.7.2 / Compose 5.4.0; no Compose project listed; one protected OmniHub Postgres running, one unrelated/unknown container exited; no TecEscola stack identified |
| VPS collector syntax | This checkpoint | `bash -n ops/health/vps-readonly.sh` passed using Git Bash |
| Docker inspect format | This checkpoint | Exact collector template succeeded for both existing local containers; no environment values or logs were read |
| Staged diff secret scan | This checkpoint | Gitleaks reported 0 findings; used a temporary auto-removed container from the preloaded image, isolated from networks |

The public publishable key was read transiently from the public frontend bundle,
used only in process memory for GET probes, and was neither printed nor saved.
No response bodies were saved. The public REST result is not evidence of
database contents or migration parity.

The Docker inventory is of the local workstation, not the VPS. The OmniHub
container/network/volume and the unrelated exited container are protected.
No pre-existing container, network, volume, or image was modified. Gitleaks
used one temporary container from the already-present image with `--network
none`, read-only root filesystem, stdin-only input, and automatic removal; it
did not interrupt or inspect any existing container. The sanitized snapshot
and `topology.json` are local-only files under `artifacts/production-closure/`
and intentionally are not committed.

## Closure status

```text
VPS_ACCESS=BLOCKED_NO_AUTHORIZED_VPS_ACCESS
PRODUCTION_TOPOLOGY_CONFIRMED=NO
DOCKER_EXISTING_CONTAINERS_PROTECTED=YES
FOREIGN_CONTAINERS_INTERRUPTED=NO

PUBLIC_FRONTEND=PASS_HTTP_200
AUTH_HEALTH=PASS_HTTP_200
DATABASE_REST=PASS_HTTP_200
STORAGE_API=PASS_HTTP_200

REALTIME_ROOT_CAUSE=UNKNOWN_NO_AUTHORIZED_VPS_ACCESS
REALTIME_CONTAINER=UNKNOWN
REALTIME_IMAGE_VERSION=UNKNOWN
REALTIME_INTERNAL_HEALTH=BLOCKED
GATEWAY_REALTIME_HEALTH=BLOCKED
PUBLIC_REALTIME_HEALTH=FAIL_HTTP_503
REALTIME_FUNCTIONAL=BLOCKED

LOCAL_MIGRATION_COUNT=121
REMOTE_MIGRATION_COUNT=UNKNOWN
SCHEMA_DRIFT_ITEMS=UNKNOWN
PRODUCTION_SCHEMA_RECONCILIATION=BLOCKED

BACKUP=BLOCKED
BACKUP_ENCRYPTED=NOT_CREATED
BACKUP_SHA256=NOT_AVAILABLE
BACKUP_VERIFY=BLOCKED
STORAGE_BACKUP=BLOCKED
RESTORE_TEST=BLOCKED
RESTORE_TARGET=NOT_CREATED
RESTORE_SCHEMA_CHECK=NOT_RUN
RESTORE_ROWCOUNT_SANITY=NOT_RUN
DISASTER_RECOVERY_READINESS=BLOCKED

SMTP_PROVIDER=UNKNOWN
SMTP_TEST_DELIVERY=BLOCKED
AUTH_INVITES=BLOCKED
AUTH_PASSWORD_RECOVERY=BLOCKED
AUTH_DELIVERY_READINESS=BLOCKED

PILOT_TENANT=BLOCKED
PILOT_IDENTITIES=BLOCKED
PLAYWRIGHT_PRODUCTION_SMOKE=BLOCKED
CROSS_TENANT_PRODUCTION=BLOCKED
PILOT_FUNCTIONAL_READINESS=BLOCKED

OBSERVABILITY_READINESS=PARTIAL_LOCAL_COLLECTOR_ONLY
PRODUCTION_ROLLBACK_REHEARSED=NO_DOCUMENTED_ONLY
FINAL_HEALTH_CHECK=FAIL_REALTIME_503
LOCAL_APPLICATION_READINESS=PASS_PREVIOUS_CAMPAIGN
PRODUCTION_INFRA_READINESS=NOT_READY
PILOT_READINESS=NOT_READY
EXTERNAL_BLOCKERS_REMAINING=5

PRODUCTION_MUTATIONS_PERFORMED=NONE
MUTATIONS_APPROVED_BY_HUMAN=NONE
PRODUCTION_DATA_LOSS=NO
CUSTOMER_CREDENTIALS_USED=NO
REAL_CUSTOMER_DATA_MODIFIED=NO
SECRETS_COMMITTED=NO
```

## Remaining external blockers

1. Authorized read-only VPS access to identify Caddy routing, Realtime service,
   container/image/health, network, dependencies, and bounded relevant logs.
2. Authorized least-privilege production database inventory to reconcile remote
   migration history and schema against the 121 local migrations.
3. Approved encrypted PostgreSQL and Storage backup destinations/keys plus a
   disposable restore target and successful verification/rehearsal.
4. Confirmed SMTP provider, authorized test mailbox, and successful invite and
   password-recovery delivery checks.
5. A designated non-customer pilot tenant and test identities, followed by
   authorized role, cross-tenant, Realtime functional, and production browser
   smoke tests after blockers 1–4 pass.

## Next action

An authorized VPS operator must provide the confirmed host/user and bounded
read-only scope, plus a separately provisioned read-only database connection.
No restart, proxy edit, database write, migration, credential change, invite,
DNS operation, or deployment is proposed while the Realtime root cause and
production schema remain unknown. The same PR #224 remains open; this campaign
does not merge it.

# TecEscola disaster recovery runbook

**Qualification:** documented procedure; not rehearsed against the production
VPS. Do not treat this document as proof of recoverability.

## Recovery targets and scope

```text
RPO=UNSET (requires product/operations owner approval)
RTO=UNMEASURED
PRODUCTION_BACKUP=NOT_AVAILABLE_TO_THIS_CAMPAIGN
RESTORE_REHEARSAL=NOT_RUN
```

Do not invent an acceptable data-loss window or recovery duration. Record and
approve RPO/RTO before a production pilot. Source code and migration files are
reconstructible from the canonical Git repository. PostgreSQL data, Storage
objects, secrets, Auth configuration, and the active proxy/Compose configuration
are persistent or critical and require separate protected recovery copies.
Database metadata does not contain the bytes of Storage objects. Secrets must
remain encrypted and stored outside Git and outside the VPS failure domain.

## Recovery sequence

1. Declare the incident, freeze risky changes, record the affected public
   endpoints, timestamp, service versions, and operator. Do not restart a
   service merely to test a hypothesis.
2. Provision a replacement host and restore the approved source/configuration
   from Git. Confirm OS, Docker, Compose, architecture, and available disk/RAM.
3. Retrieve the separately encrypted Compose/proxy/Auth configuration and
   secrets from the approved secret store. Verify ownership and scope without
   printing secret values.
4. Start the compatible self-hosted Supabase dependencies using the verified
   deployment procedure for the actual Compose project. This runbook does not
   assume service names, project name, or image tags until the production
   topology has been inventoried.
5. Restore PostgreSQL only into a clean, isolated target using the tested
   archive and the documented restore order. Restore cluster globals only after
   reviewing role/ownership conflicts. Do not restore over the source database.
6. Restore Storage metadata consistently with the database snapshot, then
   restore object bytes from the separate Storage backup. Compare checksums and
   counts without printing sensitive object paths.
7. Restore the verified Caddy configuration and certificates through the
   approved deployment procedure. Validate syntax before enabling traffic.
8. Run internal service health, public health, Auth/REST/Storage/Realtime probes,
   and the authorized non-customer pilot smoke. Confirm tenant isolation and
   critical read/write paths before cutover.
9. Keep the original source isolated and recoverable until the service owner
   accepts the replacement. Record actual elapsed recovery time and data-point
   timestamp to measure RTO/RPO.

## Rollback and escalation

If validation fails, keep traffic on the last known-good host/configuration
where it remains safe. Do not point DNS or proxy traffic at a partial restore.
Preserve the failed target for investigation; do not delete production or
unknown Docker volumes. Any DNS, proxy, service restart, credential, database,
or deployment mutation requires its own approved change record with cause,
impact, rollback, and backup state. A database restore is not a rollback plan
unless the exact archive has passed integrity verification and a disposable
restore rehearsal.

## Current blockers

- Authorized VPS topology/SSH access is unavailable to this campaign.
- No approved encrypted PostgreSQL/Storage backup destination or decrypt
  recipient is configured.
- No production backup is available for restore rehearsal.
- Caddy is observed in the public Realtime response path, but internal routing
  and service health are unknown; the public Realtime endpoint returns 503.

Current state and evidence are recorded in
`docs/production/current-production-state.md`. The self-hosted operational
commands are in `docs/operations/self-hosted-production-runbook.md`.

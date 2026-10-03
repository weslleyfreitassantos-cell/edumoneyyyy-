# Privacy technical foundation

This release adds concrete, tenant-scoped privacy controls without enabling
automatic destructive retention actions.

## Implemented

- `export_current_user_data()` returns a JSON export for the authenticated
  profile, owned account, memberships, dependents, academic records and
  learner evidence reachable through that profile.
- Export requests create a `DATA_EXPORT` audit event.
- `preview_privacy_retention()` returns active policy configuration with
  `dry_run=true` and never mutates data.
- `RETENTION_DRY_RUN` audit events record preview requests.
- Institution deletion explicitly clears Adaptive and timetable tables before
  removing the institution, while preserving the existing service-role
  authorization boundary.
- The account settings surface provides a local JSON download action.

## Human and policy gates

The release does not decide legal retention periods, legal holds, anonymization
rules, privacy notices, contracts, or data-subject response procedures. No
automatic retention executor is enabled until those policies are explicitly
configured and reviewed.

## Known limitation

The platform-account hard-delete RPC still relies on its existing transactional
deletion path and foreign-key cascades for newer domains. A follow-up should
add explicit per-domain counts and a migration-level coverage assertion before
that destructive workflow is considered fully audited.

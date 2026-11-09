# Production Release Backup Policy

Effective policy: `RELEASE_BACKUP_POLICY=NOT_REQUIRED`.

Creating or proving a local or offsite backup is not a prerequisite for an application release or migration. The release process does not create, request, restore, hash, or transmit backups and does not require per-release backup exceptions or risk-acceptance tokens. The known operational risk must remain visible as `RECOVERY_CAPABILITY=UNVERIFIED_OR_UNAVAILABLE`; a release must never report a passing backup gate under this policy.

This policy does not stop, disable, or remove existing scheduled backup or recovery services. It changes only the release prerequisite.

All independent production safeguards remain mandatory: canonical repository and clean committed source, exact reviewed commit and migration SHA-256, verified production cluster/database and executor permissions, exact predecessor and migration ledger, exactly one pending migration, selective CLI dry-run, dependency and post-apply checks, duplicate protection, transaction safety where supported, and applicable RLS/tenant-isolation validation. A destructive, irreversible, or non-transactional migration additionally requires an operation-specific review bound to its exact migration SHA-256. It never substitutes that review for backup proof or removes other authorization controls.

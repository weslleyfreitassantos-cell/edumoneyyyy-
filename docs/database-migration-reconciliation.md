# Database migration reconciliation

## Root cause

The advisor hardening SQL was committed twice under different versions:

- `20260906210000_advisor_performance_hardening.sql` was added locally in commit `627cf6e` and later made shadow-database tolerant by `22ba042`.
- `20260906222415_advisor_performance_hardening.sql` was added by `0f129e7` to represent the migration already recorded remotely.

The remote history contains `20260906222415` and does not contain `20260906210000`. Running both locally created the same five policies twice and failed with PostgreSQL `42710`.

The original file hashes found during the investigation were:

```text
20260906210000: 9AA452DB974277CA8CD097F5D250A18A8B6B0C1A82F7D3D30F3E8B4DC4B96BC3
20260906222415: 00D76C344E342B19EC60713156416DFC764DE79E831F6CCD54A06A95FB669744
```

The functional SQL was equivalent. The relevant difference was the conditional handling of the two `account_domains` indexes.

## Reconciliation applied locally

`20260906210000` was removed from the active migrations directory. Git history preserves its origin; it was never marked as applied remotely.

`20260906222415` remains the canonical version. Only these indexes were made replay-safe:

- `account_domains_created_by_idx`
- `account_domains_updated_by_idx`

On a schema containing the columns, the resulting indexes are unchanged. On a clean local schema without them, the reset skips only those two indexes.

The UTF-8 BOM was removed from `20260906143016_fix_hard_delete_owner_classification.sql`. Its SQL was not changed.

## Remaining divergence

`account_domains` still differs between the reconstructed local schema and the remote schema. This task intentionally does not add or remove columns, rename fields, change defaults, or alter constraints. That schema decision requires a separate migration review.

## Safety rule

No remote migration, `migration repair`, deploy, remote data change, or remote policy change was performed during this reconciliation.

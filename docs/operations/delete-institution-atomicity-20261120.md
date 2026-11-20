# Institution Deletion Atomicity

## Verified failure mode

The Edge Function previously issued a separate PostgREST `DELETE` for each table, then deleted the institution. Each request committed independently. Missing tables and schema-cache errors were treated alike, while the VPS schema has relations such as `subject_offerings`, `enrollments`, `guardianships`, and `terms` without a direct `institution_id`. Other `RESTRICT` foreign keys also reference institution-owned data. A later constraint failure could therefore leave earlier deletes committed.

## Change

The Edge Function now calls `delete_institution_data_atomic_v1` once. The `SECURITY DEFINER` RPC is executable only by `service_role`, checks the account/institution pair, uses a fixed dependency list, and performs child and institution deletes in the same PostgreSQL transaction. Any unhandled foreign-key dependency aborts the RPC and rolls back every delete; the Edge Function reports HTTP 409 and explicitly says no data was removed.

## Release limitation

This change is a data-integrity guard, not proof that every production dependency is mapped for successful deletion. The VPS schema has indirect dependencies and institution-scoped tables absent from the current list. Until those relationships and retention requirements are reviewed and covered, deletion may safely return 409. The migration has not been applied to production, and this PR must not be merged/deployed as evidence that institution deletion is fully available.

## Validation

`supabase/tests/delete_institution_atomicity.database.sql` covers account-scope rejection, service-role-only execution, a missing direct tenant column blocked by `RESTRICT`, rollback of earlier deletes, successful scoped deletion after the dependency is removed, and preservation of another institution. CI runs it against a disposable PostgreSQL 15 service.

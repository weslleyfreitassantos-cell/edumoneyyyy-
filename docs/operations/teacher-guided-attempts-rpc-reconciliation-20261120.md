# Tec Escola - Teacher guided attempts RPC reconciliation (2026-11-20)

## Read-only production evidence
- Authorized tecescola-vps preflight succeeded using executor supabase_admin. Latest ledger migration: 20261118000100.
- Historical migration 20261022000100_teacher_learning_guided_performance.sql is committed in GitHub, but not recorded in the VPS ledger.
- Two teacher RPCs already exist in production: list_teacher_learning_students and get_teacher_learning_student_detail.
- One RPC used by src/services/learningCenterService.ts is absent: get_teacher_guided_learning_attempts(uuid,uuid,uuid,uuid).
- Both private authorization functions, learning_teacher_can_access_subject_scope and learning_teacher_skill_in_subject, exist.
- The required guided sessions, guided steps, attempts and curriculum skills tables and referenced columns exist.
- Edge Functions comparison is separate: 14 operational files are equivalent after whitespace normalization; delete-institution has a real content difference and must not be blindly replaced.

## Surgical forward migration
- Created with Supabase CLI: 20261120163512_repair_teacher_guided_attempts_rpc.sql.
- Reuses the original scoped function from the historical migration.
- Creates only if the exact RPC signature is missing, preserving any later existing implementation.
- Revokes anonymous/PUBLIC execution and grants authenticated execution only.
- Changes no application data and does not falsify the ledger for any historical migration.
- Includes a Vitest regression test checking canonical source and permission scope.

## Deployment requirements
1. Require approved disposable Postgres CI and review of SECURITY DEFINER authorization.
2. Re-run the repository production-connection preflight and confirm canonical cluster and ledger.
3. Review exact file SHA-256 and the predecessor required by scripts/db/production-promote.sh.
4. Do not use generic supabase db push, migration repair or ad-hoc SQL in production.
5. Promote only the reviewed migration with the repository selective promoter after authorization.
6. Verify function signature and grants and validate teacher cross-institution denial with authorized pilot accounts.

This PR is independent of the Cloudflare frontend PR #484.
No production SQL writes, migrations or Edge Function deployments were performed during this audit.

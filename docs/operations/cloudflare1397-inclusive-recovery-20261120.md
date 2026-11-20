# Cloudflare 1397 inclusive education source recovery — draft reconciliation

## Reference and evidence
Current production reference: Cloudflare Worker edumoneyyyy, version 1397, UUID 823c4b88-ec65-42c5-86a7-ec71c698c8b6. Leave production untouched.

The GitHub main source of the inclusive education route renders preparation/read-only labels and does not represent the operational controls visible in the published production frontend. A GitHub branch, codex/inclusive-carousel-filter-loading, contains the full React/TypeScript UI and service code.

This branch is based on main 71c050a and selectively restores ONLY:
- src/components/inclusive/InclusiveEducationPage.tsx
- src/components/inclusive/InclusiveEducationPage.test.tsx
- src/services/inclusiveEducationService.ts
- src/services/inclusiveEducationService.test.ts

Do not merge the older source branch as a whole: it is over 90 commits behind main. The selective restoration itself must be reviewed against the current backend, not merely pass a build.

## Compiled evidence
- Live v1397 inclusive JS chunk: InclusiveEducationPage-C1kSMVnZ.js (99,930 bytes).
- Selective candidate JS chunk: InclusiveEducationPage-BLxY1C34.js (99,140 bytes).
- Prior main inclusive JS chunk: InclusiveEducationPage-CLUBAZRW.js (68,138 bytes).
- Comparing literal UI text fields, 213 of 213 identifiable live labels are also present in this candidate chunk; the main build retained 138 of 213. This is **not byte equivalence** and does not prove identical runtime behavior.
- Candidate TypeScript typecheck passed.
- Inclusive component/service Vitest suites passed, 15/15 tests.
- Vite build completed successfully.

## Hard release gates
1. Inspect the service changes, especially setting INCLUSIVE_EDUCATION_DATA_ENABLED=true, authorization/RLS, active enrollment scope, write persistence, and cross-institution isolation. Do not assume the source branch's permissions are current.
2. In isolated PostgreSQL and pilot tenant testing, verify creating/updating PEI/AEE documents, audit history, professional assignments, student scope and RLS denials; never test writes on live student data.
3. Verify all remaining release features: branding per institution, admin/teacher/student roles and application routes. This PR only recovers one known drifted module.
4. Do not merge this PR or PR #484 until the reviewed release is approved. Cloudflare auto-build from main could replace production v1397.
5. Keep migration repair PR #485 and Edge Function audit issue #486 separate.

No production data, Cloudflare deployment, migration ledger or VPS Edge Function was modified by this candidate.

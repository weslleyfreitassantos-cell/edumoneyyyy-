# TecEscola total PR integration — 2026-11-01

**Campaign:** `TECESCOLA_AUTONOMOUS_TOTAL_PR_INTEGRATION_V1`
**Repository:** `weslleyfreitassantos-cell/edumoneyyyy-`
**Snapshot:** 2026-11-01 (UTC)
**Result:** `PARTIAL` — no open feature PR was merged in this run.

This report records the current integration state and the actions taken in this campaign. It distinguishes code integration, database promotion, deployment, and content enablement.

## Main and production

- Main at inventory and final check: `9ec019b28328b755bca90169a6587fa0ce8b0b67` (`feat(tec-idiomas): show romanization across Korean learning`, PR #429).
- Production migration ledger: **251 versions**, latest `20261031000100` (read-only query through the authorized VPS SSH path).
- Production promotion path: the authorized SSH session reached the expected VPS and allowed read-only PostgreSQL inspection. The official selective promoter was not present at the checked paths (`/usr/local/bin/tec-escola-promote-migration` and `/opt/tec-escola/scripts/db/promote-single-migration.sh`), and `PRODUCTION_DB_URL` was not available in that remote environment. No alternative writer was used.
- Recovery risks retained: offsite backup `FAIL`; Storage recovery `PARTIAL`. No backup was created.
- No production migration, database write, merge to main, or deployment occurred in this campaign. The active Cloudflare Worker version was not re-queried because no compatible deployment was ready.

## PR inventory and disposition

At campaign start, the GitHub API showed six open PRs in scope: #360, #373, #406, #407, #408, and #427. PRs #356–#359 were already closed and had been classified in the previous work as equivalent to code already in main; they were not reopened or changed here.

| PR | State at end of this run | Reconciliation / checks | Database and next safe step |
|---|---|---|---|
| [#356](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/356) | Closed, not merged | Previously verified as equivalent to main; no changes in this run. | No production write. |
| [#357](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/357) | Closed, not merged | Previously verified as equivalent to main; no changes in this run. | No production write. |
| [#358](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/358) | Closed, not merged | Previously verified as equivalent to main; no changes in this run. | No production write. |
| [#359](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/359) | Closed, not merged | Previously verified as equivalent to main; no changes in this run. | Migration source is in main; production application status was not changed here. |
| [#360](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/360) | Open, not merged | Head `2961073c44d3ae09605b3d481d346c92d7aec46b`, based on the V4 branch. Existing CI evidence is mixed: validate passed; database has a failed run and a later passing run. No fresh base update was performed. | The prior reconciliation identified a 767-file historical diff with 122 migrations, 112 absent from production, and a version collision at `20261015000100` with different semantics. Preserve the real V5 delta, build a clean reconciliation against current main, and resolve the migration collision before promotion. No bulk merge or migration application. |
| [#373](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/373) | Open, not merged | Updated against main `9ec019b`; head `7a8ad27477071ffd80ec3c1df0d06f224bc0c501`. On refreshed CI, `validate=PASS`, `migration-promoter-postgres=PASS`; `database=PENDING` at the snapshot. | Migration `20261026000400_teacher_scheduling_three_shifts.sql` is absent from the production ledger. Do not merge/deploy dependent frontend before the official selective promotion is available and migration is authorized. |
| [#406](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/406) | Open, conflicting, not merged | Head `bffae85b9be52738bd61245c7e00e47ea9b595d1`, base stale at `eb404d2cd5fad3ab963c31a8cad97411cb4d9ba2`; GitHub reports `CONFLICTING`. Its real delta is 44 files, about 7,280 additions and 341 deletions. A local merge with current main surfaced conflicts in CI, promoter, app routes, and review queue; that incomplete merge was aborted, leaving the PR branch unchanged. | Migration `20261025000700` is absent; its prior production attempt returned SQLSTATE `42501` on `public.learning_central_studies_v2_candidates`. Do not port an exception by bypassing current promoter safeguards. Resolve ownership/session context and migration compatibility before merge. Status of `20261025000600` was not re-queried in this run. |
| [#407](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/407) | Draft, not merged | Stacked on #406 at `ec552318706ae1fa7374293f933a33335acf2ec3`. Older checks passed, but they are not evidence for a refreshed base. | Depends on #406. Migration `20261025000800` is absent. Keep draft until #406 is reconciled and backend is compatible. |
| [#408](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/408) | Draft, not merged | Stacked on #407 at `87b6385e55d119f5186d429fd640b5be4b9f8393`. Older checks passed, but they are not evidence for a refreshed base. | Depends on #407. Migration `20261025000900` is absent. Keep draft until predecessors are integrated safely. |
| [#427](https://github.com/weslleyfreitassantos-cell/edumoneyyyy-/pull/427) | Open, not merged | Updated against main `9ec019b`; head `39f573cdc2a7b146a3d01cc839d4257d5ec383e5`. Refreshed CI: `validate=PASS`, `database=PASS`, `migration-promoter-postgres=PASS`. | Migration `20261031000200_psychology_expired_appointment_removal.sql` is absent. Preserve the history/audit behavior and wait for an authorized promotion path before releasing dependent UI. |

### BNCC V5 equivalence snapshot (#360)

The previous scoped V4-to-V5 comparison recorded 767 files in the historical PR comparison, with 45 files identical to main, 54 divergent, and 668 only in the PR comparison. Those figures are from the earlier inventory and should be refreshed when the V5 branch is rebuilt against the current main. Ten migration versions from the PR family were already present in production; nine source files matched main, while `20261015000100` collided with a different production migration. The V5 branch is not an integration-ready representation of only the outstanding delta.

### Central Studies dependency chain (#406–#408)

Dependency order remains #406 → #407 → #408. The #406 merge conflict was not resolved by choosing either side wholesale. The PR branch’s older migration promoter and CI workflow conflict with later safeguards and checks on main. Any future reconciliation must retain current-main safeguards and port only narrowly justified Central Studies additions with dedicated tests.

## Migration reconciliation

| Version | Feature | Production state observed | Action in this campaign |
|---|---|---|---|
| `20261012000500` | BNCC V4 | Absent from ledger in the earlier read-only inventory. | Not applied; source/delta reconciliation still needed. |
| `20261015000100` | BNCC V5 historical branch | Same version is used by different SQL semantics in the V5 branch and production lineage. | Collision recorded; neither file was promoted or substituted. |
| `20261025000600` | Central Studies content review | Not re-queried during this run. | No application. |
| `20261025000700` | Central Studies runtime publication | Absent; prior application attempt failed with `42501`. | No retry or manual SQL. |
| `20261025000800` | Classroom authoring | Absent from ledger in the earlier read-only inventory. | No application. |
| `20261025000900` | Tec Quiz Live | Absent from ledger in the earlier read-only inventory. | No application. |
| `20261026000400` | Teacher scheduling | Absent from ledger in the earlier read-only inventory. | No application. |
| `20261031000200` | Expired psychology appointment removal | Absent from ledger in the earlier read-only inventory. | No application. |

The live ledger is still **251 / `20261031000100`**. The inventory above is not authorization to apply the listed migrations. Each promotion must use the official selective promoter, exact checksum, dependency checks, and the applicable write authorization.

## Checks, production safety, and deployment

- Refreshed #373: `validate=PASS`, `migration-promoter-postgres=PASS`, `database=PENDING` at snapshot.
- Refreshed #427: `validate=PASS`, `database=PASS`, `migration-promoter-postgres=PASS`.
- #360: old check evidence is mixed and not refreshed against current main.
- #406–#408: checks belong to old heads/bases and must not be treated as current green checks.
- No typecheck, build, Playwright run, or authenticated production QA was run as a separate local action in this campaign. The required CI jobs are tracked above.
- Student progress and XP: no writes were made by this campaign.
- Cloudflare: no deploy was attempted; active version and traffic percentage remain unverified in this run.
- New backups: none. Authenticated production QA: not requested.

## Actions taken

1. Queried GitHub for the live open-PR inventory, heads, bases, mergeability, and checks.
2. Updated #373 and #427 branches with current main through GitHub’s branch-update mechanism; their CI runs are identified in the PR check history.
3. Confirmed the current production ledger over the existing authorized read-only SSH path.
4. Attempted a local merge of current main into the #406 worktree to enumerate conflicts, then aborted the incomplete merge. The feature branch remains at its original commit; its untracked `ops/backup/__pycache__/` cache was preserved.
5. Made no changes to production, migrations, student records, XP, Cloudflare, or GitHub merge status.

## Final disposition

```text
INITIAL_MAIN_SHA=9ec019b28328b755bca90169a6587fa0ce8b0b67
FINAL_MAIN_SHA=9ec019b28328b755bca90169a6587fa0ce8b0b67
OPEN_PRS_AT_INVENTORY=6 (#360,#373,#406,#407,#408,#427)
OPEN_PRS_AT_SNAPSHOT=6 (#360,#373,#406,#407,#408,#427)
MERGES_IN_THIS_CAMPAIGN=0
CLOSED_AS_EQUIVALENT_BEFORE_THIS_CAMPAIGN=4 (#356–#359)
MIGRATIONS_APPLIED_IN_THIS_CAMPAIGN=0
PRODUCTION_LEDGER=251 / 20261031000100
PRODUCTION_DEPLOY=NOT_RUN
BACKUP_CREATED=NO
AUTHENTICATED_QA=NOT_REQUESTED
FINAL_RESULT=PARTIAL
```

**Blocking actions:** restore the documented authorized selective-promotion mechanism for the production VPS without exposing credentials; finish the database jobs for #373/#427; resolve the migration 007 privilege/context defect before considering #406; rebuild #360 as a reviewable V5-only delta and resolve its migration collision; then refresh the stacked #407/#408 and promote each necessary migration in dependency order. Keep the content and institutional release states unchanged until their own controls are met.

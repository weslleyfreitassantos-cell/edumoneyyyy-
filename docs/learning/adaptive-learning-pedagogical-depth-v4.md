# Adaptive Learning V4

V4 is an additive pedagogical contract for TecEscola. It separates the
curriculum graph from the mastery planner:

- `ANCHOR` nodes describe broad domains and are never direct mastery targets.
- `LEAF` nodes are the diagnostic units used by the planner.
- `GRAPH_ONLY` means the graph exists but has no ready learning journey.
- `CONTENT_READY` means authored material exists but the adaptive contract is incomplete.
- `ADAPTIVE_READY` means the leaf has a lesson and the full probe, practice, transfer,
  lock-in and review contract required by the planner.

Hierarchy and prerequisites are intentionally different relations. The compiler
validates references, duplicate content, cycles, question contracts,
misconception tags and context diversity before it generates the forward-only
migration `20261001000100_adaptive_learning_pedagogical_depth_v4.sql`.

## Current pack status

The checked-in pack is a scaled, reviewable foundation:

- 15 subjects
- 456 canonical nodes
- 36 anchors and 420 leaves
- 214 `ADAPTIVE_READY` leaves and 206 `GRAPH_ONLY` leaves
- 248 lessons and 1,715 authored questions
- 48 cross-subject relationships

The source of truth is split by subject under
`content/adaptive/tec-escola-core-v4/subjects/{subject}/`:
`skills.json`, `lessons.json` and `questions.json`. `GRAPH_ONLY` leaves keep
their hierarchy/prerequisite edges but are not mastery targets and are skipped
by the V4 runtime with `CONTENT_NOT_READY` rather than being marked mastered.
The pack remains `PEDAGOGICAL_REVIEW_PENDING` until the authored content is
reviewed by the pedagogical team.

V4 never cancels an active or paused V2/V3 session. It returns the structured
`LEARNING_V4_EXISTING_SESSION_OTHER_ENGINE` decision and the service preserves
the existing engine. Bridge steps are limited to two active levels.

## Commands

```bash
npm run adaptive:v4:validate
npm run adaptive:v4:compile
```

Compilation is deterministic and writes the generated migration plus
`content/adaptive/tec-escola-core-v4/coverage.json`. This campaign does not
apply the migration, seed production, or change Auth, RLS infrastructure or
Cloudflare configuration.

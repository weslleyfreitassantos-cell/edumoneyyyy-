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

The checked-in pack is a representative, reviewable foundation:

- 15 subjects
- 70 canonical nodes
- 36 anchors and 34 leaves
- 4 `ADAPTIVE_READY` leaves
- 10 lessons and 35 authored questions

The remaining subjects and leaves are deliberately marked `GRAPH_ONLY` or
`CONTENT_READY`; the planner must not pretend they are ready. The pack remains
`PEDAGOGICAL_REVIEW_PENDING` until the authored content is reviewed by the
pedagogical team.

## Commands

```bash
npm run adaptive:v4:validate
npm run adaptive:v4:compile
```

Compilation is deterministic and writes the generated migration plus
`content/adaptive/tec-escola-core-v4/coverage.json`. This campaign does not
apply the migration, seed production, or change Auth, RLS infrastructure or
Cloudflare configuration.

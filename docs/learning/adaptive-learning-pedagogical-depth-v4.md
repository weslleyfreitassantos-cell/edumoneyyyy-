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

The checked-in pack is an explicit, reviewable foundation. It deliberately
does not inflate coverage with generated copies:

- 15 subjects
- 97 canonical nodes: 45 anchors and 52 semantic leaves
- 15 `ADAPTIVE_READY` leaves and 37 `GRAPH_ONLY` leaves
- 15 lessons and 195 selectable questions
- 180 questions reused from the validated V3 pack and 15 concrete V4 review questions
- 6 explicit cross-subject relationships
- 179 misconception details with a title, explanation and affected skill

Only the 15 ready leaves currently have a complete adaptive journey. The
remaining leaves are honest `GRAPH_ONLY` scaffolding: they keep explicit
hierarchy and semantic relationships without pretending that lessons and
questions exist. Ready leaves carry explicit objectives, descriptions,
mastery capabilities, stage metadata and authoring status. The compiler rejects
numeric duplicate concepts, semantic duplicate skills, generic template
families and incomplete misconception details; there are no quota gates for
node, lesson, question or relationship counts.

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
`content/adaptive/tec-escola-core-v4/coverage.json`. The legacy
`generate-v4-content.ts` command is now validation-only and never writes
content. This campaign does not
apply the migration, seed production, or change Auth, RLS infrastructure or
Cloudflare configuration.

# Adaptive Learning V3

V3 extends the V2 guided journey with a small, explicit knowledge graph. It
keeps the server-planned journey and append-only evidence model from V2; it
does not create a second adaptive engine.

## Question graph

Every question that is eligible for a V3 question set has exactly one
`PRIMARY` link and may have `SUPPORTING`, `PREREQUISITE`, and `TRANSFER` links.
Links are allowed to cross subjects. A V3 question is only publishable when
its subject, domain, topic, cognitive process, purpose, provenance and mapping
status are present. Legacy unmapped questions stay outside V3 sets.

The canonical subject registry is global and intentionally separate from an
institution's `subjects` rows. Institutional aliases must be mapped
explicitly; ambiguous labels are not silently guessed.

## Evidence attribution

`KNOWLEDGE_ATTRIBUTION_POLICY=V1` is shared by the TypeScript contract tests
and the database attribution tables. A correct primary answer creates normal
positive evidence. Supporting and prerequisite skills receive positive
evidence only when their link is marked `evidence_bearing`. A wrong answer
only penalizes the primary skill unless a distractor has an explicit
misconception mapping.

The `learning_evidence_attributions` table records role, confidence, question,
attempt, purpose, context and decision reason. This keeps the primary skill
score separate from derived signals and leaves room for constructed responses,
rubrics, projects and teacher observations.

## Misconceptions and recovery

Option-level mappings live in `learning_question_option_misconceptions` and
point to normalized misconception tags. A wrong mapped distractor creates a
`SIGNAL`; repeated coherent errors move through `SUSPECTED` to `CONFIRMED`.
The confirmation policy requires repeated evidence in diverse contexts. A
single error never confirms a gap. Positive evidence moves a confirmed signal
through `RECOVERING` and, after sufficient recovery, `RESOLVED`.

## Cross-subject bridge

`learning_skill_relationships` stores prerequisite, related and transfer edges
without requiring both skills to have the same subject. The V3 planner returns
the original target and a short bridge when a confirmed blocker is found. The
original target is retained in the guided session, so the learner can return
to it after recovery.

## Subjects and capability

The initial registry covers Portuguese, Mathematics, Science, Biology, Physics,
Chemistry, History, Geography, Philosophy, Sociology, Art, Physical Education,
English, Religious Education and Computing. Each has at least three canonical
skills and one objective-evidence target vertical. Art and Physical Education
are explicitly capability-limited; objective questions do not claim to assess
future production or observation evidence.

## BNCC role

BNCC metadata is optional reference information. It can support curriculum
coverage and review, but it is not the TecEscola methodology, mastery policy,
prerequisite graph or adaptive planner.

## Limitations and next increment

The first V3 verticals are deterministic authored fixtures, not a full
curriculum. The next increment can add reviewed BNCC references, richer
question writing, constructed responses, teacher rubrics, projects and
observation evidence. No LLM tutor, ML mastery, TRI, automatic essay grading,
vision grading or audio grading is part of V3.

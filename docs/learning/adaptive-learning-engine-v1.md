# TecEscola Adaptive Learning Engine v1

## Purpose

This increment adds a small, deterministic foundation for adaptive learning without reopening the MVP. The school year remains the destination context, while a canonical curriculum graph and student evidence determine a safe next step.

The first proof slice is Mathematics:

`Frações -> Razão -> Proporção -> Porcentagem -> Equações -> Função afim`

The catalog is global and versioned. Institutional `learning_units` and `learning_skills` remain the authoring and compatibility layer; `learning_skill_canonical_links` maps an institutional skill to a canonical skill when a school is ready to use adaptive guidance.

## Data model

- `learning_curriculum_catalogs`: global catalog/version metadata.
- `learning_curriculum_skills`: canonical skills with stage, expected grade, subject area, domain and stable code.
- `learning_skill_prerequisites`: directed prerequisite edges. A row means `skill_id` requires `prerequisite_skill_id`.
- `learning_skill_canonical_links`: tenant-scoped mapping from an existing institutional skill to canonical content.
- `learning_curriculum_subject_links`: explicit tenant-scoped mapping from an institutional subject to a canonical subject area.
- `learning_curriculum_grade_targets`: explicit catalog targets by stage, grade, subject area, priority and order.
- `learning_attempt_runs` and `learning_attempt_run_answers`: append-only submission history.
- `learning_skill_evidence`: append-only evidence connected to a student, canonical skill and optional attempt run.
- `learning_student_skill_state`: a materialized, deterministic summary. The existing `learning_skill_progress` table remains untouched as the legacy compatibility surface.

Expected grade is metadata for curriculum planning, not an access restriction. A student may receive a prerequisite from another stage when the graph indicates that it is the useful next step.

## Deterministic state policy

The v1 state refresh uses all evidence for a student and canonical skill:

- zero evidence: `UNKNOWN`, confidence `0`;
- one evidence: `INTRODUCED`, confidence `1/3`;
- at least two pieces with average below `60`: `NEEDS_REVIEW`;
- at least three pieces with average at least `80`: `MASTERED`;
- other repeated evidence: `PRACTICING`;
- confidence is `min(1, evidence_count / 3)`.

One incorrect answer never creates a prerequisite gap by itself. The planner only treats a prerequisite as a confirmed gap after repeated low evidence.

## Probe and path planner

The TypeScript engine is pure and deterministic. It walks the prerequisite DAG in prerequisite-first order:

- `ON_TARGET` when the target is mastered;
- `DIAGNOSTIC_NEEDED` when the first unresolved point has insufficient evidence;
- `BRIDGE_REINFORCEMENT` when a prerequisite has repeated low evidence.

Mastered prerequisites are removed from the generated path. The canonical fraction-to-linear-function case therefore produces a bridge through the unresolved skills, while a student who already masters the prerequisites receives only a diagnostic step for the target.

The student target is resolved before planning through active enrollment, class `grade_level`, an active subject offering, the institutional skill, its canonical link and an explicit grade target. The first-year high-school Mathematics fixture targets `Função afim`; the UI never treats the first published activity as a curriculum target. If this relation is not configured, the study center keeps its legacy behavior and does not render adaptive guidance.

## UI integration

The student Central de Estudos shows `Seu próximo passo` only when a mapped target and adaptive data exist. Without that data, the current study center continues to behave as before.

The Central Pedagógica adds a read-only readiness panel backed by `get_teacher_adaptive_insights`. The RPC scopes rows to students assigned to the teacher's offering for the mapped subject, or to institution operators with the existing operational permission. A teacher assigned to Portuguese cannot read Mathematics state merely because both subjects share a class. It does not invent rows when there is no evidence.

## Security and compatibility

Canonical catalog content is readable to authenticated users but has no authenticated write policy. Learner state, evidence and attempt history are readable only by the student who owns the row, a teacher assigned to that student's class, or an institution operator in the existing tenant scope. No cross-tenant policy is added.

`submit_learning_attempt` still updates the existing summary and answer tables so the current activity flow remains compatible. It additionally creates one immutable run, its answers, canonical evidence when a mapping exists, and a refreshed learner state.

The student activity RPC no longer returns `explanation` or any answer key before submission. Teacher authoring continues to retain explanations for the existing authoring flow.

## Scope limits

This v1 does not implement AI, ENEM ingestion, TRI, simulation authoring, spaced repetition, ranking, gamification or a complete national curriculum. It creates the smallest usable contract for those later increments without coupling canonical content to a tenant or changing academic calculations.

# TecEscola Adaptive Learning Engine V2

V2 keeps the V1 curriculum catalog, question bank and evidence tables as its
compatibility layer and adds a server-planned guided journey.

## Journey contract

The state machine is `TARGET -> PROBE -> EVIDENCE -> REPLAN`, followed by the
smallest useful `LESSON`, `PRACTICE`, `TRANSFER`, `LOCK_IN` or `REVIEW` step.
The server persists only the current step. A new step is appended after a
lesson action or a scored question run, so a later answer cannot leave a large
obsolete path in the database.

`learning_guided_session_events` is append-only. It stores structured decision
codes such as `PREREQUISITE_UNKNOWN`, `CONFIRMED_GAP`, `PRACTICE_REQUIRED`,
`TRANSFER_REQUIRED`, `TARGET_READY`, `REVIEW_REQUIRED` and
`TEACHER_SUPPORT_REQUIRED`; it never stores chain-of-thought.

## Content and security

`learning_question_sets` are scoped as `TEACHER`, `INSTITUTION` or `GLOBAL`.
They reference `learning_question_bank` items rather than copying stems. The
selection order is teacher, institution, global. A guided step without content
is rejected. The V2 read RPC omits `correct_answer` and `explanation`; the
submit RPC validates the tenant and student, scores on the server, persists an
attempt and then returns feedback.

The old self-reported review score RPC is intentionally neutralized. A lesson
completion is progress, not mastery evidence. Only observable question
performance appends evidence.

## Mastery policy

The V2 policy is deterministic and versioned as `V2`: at least three valid
evidence records, two distinct runs, weighted mastery of at least 80, confidence
of at least 0.6, and one strong `TRANSFER`, `LOCK_IN` or `REVIEW` record.
The transparent source weights are `0.8` for `PROBE`/`DIAGNOSTIC`, `1.0` for
`PRACTICE` and `1.2` for `TRANSFER`/`LOCK_IN`/`REVIEW`; the same formula is
mirrored in the TypeScript test engine and the database refresh function.
The database refresh function is the source of truth; TypeScript only consumes
the resulting state.

The graph traversal is deterministic and rejects cycles/self references.
`resolveAdaptiveCurriculumTargets` keeps one target per class and subject area,
with the V1 single-target wrapper retained for compatibility. The engine is
generic and does not require ENEM content. Mathematics is the first deep
slice; a second subject can use the same contract without a math hardcode.

## Operational limits

Two automatic replans are allowed before `NEEDS_TEACHER_SUPPORT`. Teacher-scoped
insights can resume, close or override a session through a server-side RPC.
Tenant scope is checked with `auth.uid()`, institution access and student
ownership on every new function. Existing V1 sessions and learning activities
remain available when V2 mappings/content are absent.

Known limitation: the full local Supabase runtime is required to exercise the
SQL RPCs end to end. Static migration tests and pure engine tests run without
Docker; this branch does not touch production.

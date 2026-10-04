import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261003001300_teacher_subject_scope_gate.sql'),
  'utf8',
);

describe('teacher subject scope gate migration', () => {
  it('authorizes through the canonical offering and active enrollment relations', () => {
    expect(migration).toContain('public.subject_offerings');
    expect(migration).toContain('offering.teacher_profile_id = auth.uid()');
    expect(migration).toContain('offering.subject_id = subject.id');
    expect(migration).toContain('lower(btrim(enrollment.status)) = \'active\'');
    expect(migration).toContain('private.learning_teacher_can_access_subject_scope');
  });

  it('keeps the teacher RPC contracts contextual instead of exposing legacy broad reads', () => {
    expect(migration).toContain('drop function if exists public.list_teacher_learning_students(uuid);');
    expect(migration).toContain('drop function if exists public.get_teacher_learning_student_detail(uuid, uuid);');
    expect(migration).toContain('drop function if exists public.get_teacher_student_knowledge_graph_v3(uuid, uuid);');
    expect(migration).toContain('drop function if exists public.get_teacher_class_knowledge_heatmap_v3(uuid, uuid);');
    expect(migration).toContain('p_class_id uuid');
    expect(migration).toContain('p_subject_id uuid');
  });

  it('filters both the class heatmap and the student graph by the linked subject area', () => {
    expect(migration).toContain('private.learning_teacher_skill_in_subject');
    expect(migration).toContain("raise exception 'LEARNING_TEACHER_SUBJECT_SCOPE_DENIED'");
    expect(migration).toContain("raise exception 'LEARNING_KNOWLEDGE_GRAPH_SCOPE_DENIED'");
  });
});

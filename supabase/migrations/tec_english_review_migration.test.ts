import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261025000400_tec_english_pedagogical_review.sql'),
  'utf8',
);
const content = JSON.parse(readFileSync(
  resolve(process.cwd(), 'content/english/tec-english-foundations-v1.json'),
  'utf8',
));

describe('Tec Inglês human review migration', () => {
  it('records immutable reviewer, version, decision, notes, date and snapshot fingerprint', () => {
    expect(migration).toContain('create table public.tec_english_pedagogical_reviews');
    expect(migration).toContain('reviewer_id_snapshot uuid not null');
    expect(migration).toContain('reviewed_at timestamptz not null default now()');
    expect(migration).toContain('snapshot_fingerprint text not null');
    expect(migration).toContain('reviewer_email text not null');
  });

  it('restricts preview and decisions to active Super Admins and publishes atomically by checklist', () => {
    expect(migration).toContain("if not public.is_platform_super_admin() then");
    expect(migration).toContain("raise exception 'TEC_ENGLISH_REVIEW_CHECKLIST_INCOMPLETE'");
    expect(migration).toContain("raise exception 'TEC_ENGLISH_REVIEW_CONTENT_CHANGED'");
    expect(migration).toContain("raise exception 'TEC_ENGLISH_CONTENT_VERSION_IMMUTABLE'");
    expect(migration).toContain("set publication_status = 'PUBLISHED', review_status = 'PEDAGOGICAL_REVIEWED'");
    expect(migration).toContain("review.snapshot_fingerprint = private.tec_english_course_fingerprint");
    expect(migration).toContain('grant execute on function public.review_tec_english_course_v1(text, integer, text, text, text, jsonb) to authenticated;');
    expect(migration).toContain('revoke all on table public.tec_english_pedagogical_reviews from public, anon, authenticated;');
  });

  it('keeps the real course pending for human review; automated tests cannot approve its source file', () => {
    expect(content.course.publicationStatus).toBe('STAGING');
    expect(content.course.reviewStatus).toBe('PEDAGOGICAL_REVIEW_PENDING');
    expect(content.units.flatMap((unit: any) => unit.lessons).length).toBe(12);
    expect(content.units.flatMap((unit: any) => unit.lessons).every((lesson: any) => lesson.sentences.length >= 4)).toBe(true);
  });

  it('requires an exact human-approved fingerprint and an explicit institution release before student RPCs expose content', () => {
    expect(migration).toContain('create table public.tec_english_course_releases');
    expect(migration).toContain("enabled boolean not null default false");
    expect(migration).toContain('private.tec_english_course_available(p_institution_id, v_course_code, v_test_mode)');
    expect(migration).toContain("and release.content_version = course.content_version");
    expect(migration).toContain("and review.snapshot_fingerprint = private.tec_english_course_fingerprint(course.course_code, course.content_version)");
    expect(migration).toContain("raise exception 'TEC_ENGLISH_COURSE_NOT_AVAILABLE'");
    expect(migration).toContain("comment on table public.tec_english_course_releases is 'Institution allow-list for gradual Tec Inglês release; no school is enabled by default.'");
    expect(migration).toContain('create or replace function public.get_tec_english_map_v1(p_institution_id uuid)');
    expect(migration).toContain('create or replace function public.start_tec_english_lesson_v1(p_institution_id uuid, p_lesson_id text)');
    expect(migration).toContain('create or replace function public.get_tec_english_session_v1(p_institution_id uuid, p_session_id uuid)');
    expect(migration).toContain('create or replace function public.submit_tec_english_answer_v1(');
  });
});

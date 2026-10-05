import { beforeEach, describe, expect, it, vi } from 'vitest';

const { supabaseFrom, supabaseRpc } = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  supabaseRpc: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: supabaseFrom,
    rpc: supabaseRpc,
  },
}));

import {
  filterTeacherOfferingsToCurrentTerm,
  teacherDashboardService,
  type TeacherOffering,
} from './teacherDashboardService';

const currentDate = '2026-10-05';

const baseOffering: TeacherOffering = {
  id: 'offering-1',
  classId: 'class-1',
  subjectId: 'subject-1',
  termId: 'term-1',
  className: '1ª Série A',
  gradeLevel: '1º EM',
  shift: 'Integral',
  capacity: 30,
  subjectName: 'Física',
  subjectCode: 'FIS',
  workload: 120,
  termName: '1º Bimestre',
  termStartDate: '2026-02-02',
  termEndDate: '2026-04-17',
  studentCount: 0,
};

function offering(overrides: Partial<TeacherOffering>): TeacherOffering {
  return { ...baseOffering, ...overrides };
}

function queryWithRows(rows: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: rows, error: null });
  return query;
}

function rawOffering(overrides: Record<string, unknown> = {}) {
  return {
    id: 'offering-1',
    class_id: 'class-1',
    subject_id: 'subject-1',
    teacher_profile_id: 'teacher-1',
    term_id: 'term-4',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    classes: {
      id: 'class-1',
      institution_id: 'institution-1',
      name: '1ª Série A',
      grade_level: '1º EM',
      shift: 'Integral',
      capacity: 30,
      active: true,
    },
    subjects: {
      id: 'subject-1',
      institution_id: 'institution-1',
      name: 'Física',
      code: 'FIS',
      workload: 120,
      active: true,
    },
    terms: {
      id: 'term-4',
      name: '4º Bimestre',
      start_date: '2026-10-05',
      end_date: '2026-12-18',
      active: true,
    },
    ...overrides,
  };
}

describe('filterTeacherOfferingsToCurrentTerm', () => {
  it('retorna todas as ofertas do período corrente, não apenas uma', () => {
    const result = filterTeacherOfferingsToCurrentTerm(
      [
        baseOffering,
        offering({
          id: 'offering-2',
          classId: 'class-2',
          className: '2ª Série A',
          termId: 'term-4',
          termName: '4º Bimestre',
          termStartDate: '2026-10-05',
          termEndDate: '2026-12-18',
        }),
        offering({
          id: 'offering-3',
          classId: 'class-3',
          className: '3ª Série A',
          termId: 'term-4',
          termName: '4º Bimestre',
          termStartDate: '2026-10-05',
          termEndDate: '2026-12-18',
        }),
      ],
      currentDate,
    );

    expect(result.map(({ id }) => id)).toEqual([
      'offering-2',
      'offering-3',
    ]);
  });

  it('inclui início e fim do período e retorna vazio fora de qualquer período', () => {
    const terms = [
      offering({
        termId: 'term-4',
        termStartDate: '2026-10-05',
        termEndDate: '2026-12-18',
      }),
    ];

    expect(filterTeacherOfferingsToCurrentTerm(terms, '2026-10-05')).toHaveLength(1);
    expect(filterTeacherOfferingsToCurrentTerm(terms, '2026-12-18')).toHaveLength(1);
    expect(filterTeacherOfferingsToCurrentTerm(terms, '2026-10-04')).toEqual([]);
    expect(filterTeacherOfferingsToCurrentTerm(terms, '2026-12-19')).toEqual([]);
  });
});

describe('teacherDashboardService current-term scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('consulta roster e calcula totais somente com ofertas do período atual', async () => {
    const rows = [
      rawOffering({ id: 'historical-offering', term_id: 'term-1', terms: { id: 'term-1', name: '1º Bimestre', start_date: '2026-02-02', end_date: '2026-04-17', active: true } }),
      rawOffering({ id: 'current-offering-1' }),
      rawOffering({ id: 'current-offering-2', class_id: 'class-2', subject_id: 'subject-2', classes: { ...rawOffering().classes, id: 'class-2', name: '2ª Série A' }, subjects: { ...rawOffering().subjects, id: 'subject-2', name: 'Química', code: 'QUI' } }),
      rawOffering({ id: 'other-institution', classes: { ...rawOffering().classes, institution_id: 'institution-2' } }),
      rawOffering({ id: 'inactive-offering', active: false }),
    ];
    const query = queryWithRows(rows);
    supabaseFrom.mockReturnValue(query);
    supabaseRpc.mockResolvedValue({
      data: [
        { offering_id: 'current-offering-1', student_id: 'student-1' },
        { offering_id: 'current-offering-2', student_id: 'student-1' },
        { offering_id: 'current-offering-2', student_id: 'student-2' },
      ],
      error: null,
    });

    const result = await teacherDashboardService.getDashboard(
      'teacher-1',
      'institution-1',
      currentDate,
    );

    expect(result.offerings.map(({ id }) => id)).toEqual([
      'current-offering-1',
      'current-offering-2',
    ]);
    expect(result.totals).toEqual({
      offerings: 2,
      classes: 2,
      subjects: 2,
      students: 2,
    });
    expect(supabaseRpc).toHaveBeenCalledTimes(1);
    expect(supabaseRpc).toHaveBeenCalledWith(
      'get_teacher_offering_rosters',
      {
        target_offering_ids: [
          'current-offering-1',
          'current-offering-2',
        ],
        effective_date: currentDate,
      },
    );
  });

  it('não consulta roster e retorna totais vazios sem período corrente', async () => {
    const query = queryWithRows([
      rawOffering({
        terms: {
          id: 'term-4',
          name: '4º Bimestre',
          start_date: '2026-10-05',
          end_date: '2026-12-18',
          active: true,
        },
      }),
    ]);
    supabaseFrom.mockReturnValue(query);

    const result = await teacherDashboardService.getDashboard(
      'teacher-1',
      'institution-1',
      '2026-10-04',
    );

    expect(result.offerings).toEqual([]);
    expect(result.totals).toEqual({
      offerings: 0,
      classes: 0,
      subjects: 0,
      students: 0,
    });
    expect(supabaseRpc).not.toHaveBeenCalled();
  });
});

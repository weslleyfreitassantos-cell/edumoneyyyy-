import { describe, expect, it } from 'vitest';

import type { InstitutionAttendanceSession, InstitutionClassDiaryEntry } from '../../services/attendanceService';
import type {
  InstitutionAssessmentResult,
  InstitutionStudentPerformance,
} from '../../services/gradeService';
import {
  buildActivityPerformanceSummary,
  buildClassPerformance,
  buildStudentSituationSummary,
  buildWeeklyAttendanceTrend,
  classifyStudentSituation,
  countPendingAcademicItems,
  DEFAULT_PANORAMA_PERIOD,
  getPanoramaMetricDisplay,
  getPanoramaMetricProgress,
  getAttendanceChartDomain,
  mergePanoramaClassOptions,
  PANORAMA_UNAVAILABLE_MESSAGE,
} from './directorAcademicPanoramaUtils';

function session(
  sessionDate: string,
  records: Array<{ studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }>,
): InstitutionAttendanceSession {
  return {
    id: `${sessionDate}-session`,
    sessionDate,
    status: 'CLOSED',
    startsAt: '08:00',
    endsAt: '08:50',
    topic: null,
    classActivity: null,
    homework: null,
    notes: null,
    createdBy: null,
    closedAt: null,
    offering: {
      id: 'offering-1',
      institutionId: 'institution-1',
      classId: 'class-1',
      subjectId: 'subject-1',
      teacherProfileId: 'teacher-1',
      termId: 'term-1',
      className: '1ª Série A',
      gradeLevel: null,
      shift: null,
      subjectName: 'Matemática',
      subjectCode: null,
      workload: null,
      teacherName: 'Professora Ana',
      teacherEmail: 'ana@example.com',
      termName: '1º Bimestre',
      academicYearId: 'year-1',
      academicYearName: '2026',
      termStartDate: '2026-01-01',
      termEndDate: '2026-12-31',
    },
    records: records.map((record, index) => ({
      id: `${sessionDate}-record-${index}`,
      sessionId: `${sessionDate}-session`,
      subjectOfferingId: 'offering-1',
      studentId: record.studentId,
      studentName: `Aluno ${record.studentId}`,
      registrationNumber: null,
      status: record.status,
      notes: null,
      recordedAt: `${sessionDate}T08:00:00.000Z`,
      sessionDate,
      subjectName: 'Matemática',
      subjectCode: null,
      className: '1ª Série A',
      teacherName: 'Professora Ana',
    })),
    summary: {
      totalRecords: records.length,
      presentRecords: records.filter((record) => record.status !== 'ABSENT').length,
      absentRecords: records.filter((record) => record.status === 'ABSENT').length,
      lateRecords: records.filter((record) => record.status === 'LATE').length,
      excusedRecords: 0,
      attendanceRate: records.length === 0
        ? 0
        : Math.round((records.filter((record) => record.status !== 'ABSENT').length / records.length) * 1000) / 10,
    },
  };
}

function assessment(
  classId: string,
  className: string,
  averagePercent: number | null,
  launchedCount: number,
  expectedStudentCount = 2,
): InstitutionAssessmentResult {
  return {
    assessment: {
      id: `${classId}-${averagePercent ?? 'pending'}`,
      institutionId: 'institution-1',
      subjectOfferingId: `${classId}-offering`,
      termId: 'term-1',
      title: 'Avaliação',
      description: null,
      assessmentType: 'EXAM',
      assessmentDate: '2026-03-10',
      maxScore: 10,
      weight: 1,
      status: 'PUBLISHED',
      createdBy: null,
      publishedAt: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      offering: {
        id: `${classId}-offering`,
        institutionId: 'institution-1',
        classId,
        subjectId: 'subject-1',
        teacherProfileId: 'teacher-1',
        termId: 'term-1',
        academicYearId: 'year-1',
        className,
        gradeLevel: null,
        shift: null,
        subjectName: 'Matemática',
        subjectCode: null,
        workload: null,
        teacherName: 'Professora Ana',
        teacherEmail: 'ana@example.com',
        termName: '1º Bimestre',
      },
    },
    studentIds: ['student-1', 'student-2'],
    expectedStudentCount,
    launchedCount,
    missingCount: Math.max(expectedStudentCount - launchedCount, 0),
    excusedCount: 0,
    averageScore: averagePercent === null ? null : averagePercent / 10,
    averagePercent,
  };
}

describe('director academic panorama helpers', () => {
  it('classifica estudantes pelas regras de frequência e desempenho', () => {
    expect(classifyStudentSituation(90, 80)).toBe('REGULAR');
    expect(classifyStudentSituation(80, 80)).toBe('ATTENTION');
    expect(classifyStudentSituation(90, 49.9)).toBe('CRITICAL');
    expect(classifyStudentSituation(null, null)).toBe('NO_DATA');
  });

  it('usa o bimestre atual como período inicial do panorama', () => {
    expect(DEFAULT_PANORAMA_PERIOD).toBe('term');
  });

  it('mantém turmas sem lançamentos no filtro do panorama', () => {
    expect(mergePanoramaClassOptions(
      [{ id: 'class-2', label: '2ª Série A' }],
      [{ id: 'class-1', label: '1ª Série A' }],
      [{ id: 'class-2', label: '2ª Série A' }],
    )).toEqual([
      ['class-1', '1ª Série A'],
      ['class-2', '2ª Série A'],
    ]);
  });

  it('não transforma métrica indisponível em zero ou progresso falso', () => {
    expect(getPanoramaMetricDisplay(0, true)).toBe(PANORAMA_UNAVAILABLE_MESSAGE);
    expect(getPanoramaMetricDisplay(4, false)).toBe(4);
    expect(getPanoramaMetricProgress(0, 4, true)).toBe(0);
    expect(getPanoramaMetricProgress(2, 4, false)).toBe(50);
  });

  it('agrega frequência semanal contando atraso como presença', () => {
    const points = buildWeeklyAttendanceTrend([
      session('2026-03-02', [
        { studentId: 'student-1', status: 'PRESENT' },
        { studentId: 'student-2', status: 'ABSENT' },
      ]),
      session('2026-03-04', [
        { studentId: 'student-1', status: 'LATE' },
        { studentId: 'student-2', status: 'PRESENT' },
      ]),
    ]);

    expect(points).toHaveLength(1);
    expect(points[0].attendanceRate).toBe(75);
    expect(points[0].totalRecords).toBe(4);
  });

  it('ignora semanas sem registros para não desenhar uma queda falsa para zero', () => {
    const points = buildWeeklyAttendanceTrend([
      session('2026-03-02', []),
      session('2026-03-04', [
        { studentId: 'student-1', status: 'PRESENT' },
      ]),
    ]);

    expect(points).toHaveLength(1);
    expect(points[0].attendanceRate).toBe(100);
  });

  it('aproxima a escala do gráfico dos dados e mantém a meta visível', () => {
    expect(getAttendanceChartDomain([
      { key: '1', label: '02 fev', attendanceRate: 82, totalRecords: 10 },
      { key: '2', label: '09 fev', attendanceRate: 91, totalRecords: 10 },
    ])).toEqual({ min: 70, max: 100 });
  });

  it('separa desempenho por turma contando alunos únicos, não avaliações', () => {
    const students: InstitutionStudentPerformance[] = [
      { studentId: 'student-1', studentName: 'Ana', classId: 'class-1', className: '1ª Série A', performancePercent: 80 },
      { studentId: 'student-1', studentName: 'Ana', classId: 'class-1', className: '1ª Série A', performancePercent: 80 },
      { studentId: 'student-2', studentName: 'Bruno', classId: 'class-1', className: '1ª Série A', performancePercent: 55 },
      { studentId: 'student-3', studentName: 'Caio', classId: 'class-1', className: '1ª Série A', performancePercent: null },
      { studentId: 'student-4', studentName: 'Dani', classId: 'class-2', className: '2ª Série A', performancePercent: 40 },
    ];

    const points = buildClassPerformance(students);

    expect(points).toEqual([
      expect.objectContaining({ className: '1ª Série A', adequate: 1, attention: 1, critical: 0, total: 2, withoutPerformance: 1 }),
      expect.objectContaining({ className: '2ª Série A', adequate: 0, attention: 0, critical: 1, total: 1, withoutPerformance: 0 }),
    ]);
  });

  it('resume o desempenho das atividades por faixa', () => {
    expect(buildActivityPerformanceSummary([
      assessment('class-1', '1ª Série A', 85, 2),
      assessment('class-1', '1ª Série A', 65, 1),
      assessment('class-1', '1ª Série A', 40, 2),
      assessment('class-1', '1ª Série A', null, 0),
    ])).toEqual({
      totalActivities: 4,
      aboveTarget: 1,
      attention: 1,
      critical: 1,
      withoutAverage: 1,
      launchedActivities: 3,
      pendingGrades: 3,
    });
  });

  it('conta pendências reais do diário e das notas', () => {
    const entries = [
      { diaryStatus: 'PENDING' },
      { diaryStatus: 'DRAFT' },
      { diaryStatus: 'COMPLETED' },
    ] as unknown as InstitutionClassDiaryEntry[];

    expect(countPendingAcademicItems(entries, [
      assessment('class-1', '1ª Série A', 80, 1),
      assessment('class-1', '1ª Série A', null, 0),
    ])).toEqual({
      attendancePending: 2,
      missingGrades: 3,
      assessmentsWithoutLaunch: 1,
    });
  });

  it('resume a distribuição de situações sem esconder estudantes sem dados', () => {
    expect(buildStudentSituationSummary([
      { studentId: '1', studentName: 'A', classId: 'c', className: 'A', attendanceRate: 90, performancePercent: 80 },
      { studentId: '2', studentName: 'B', classId: 'c', className: 'A', attendanceRate: 80, performancePercent: null },
      { studentId: '3', studentName: 'C', classId: 'c', className: 'A', attendanceRate: null, performancePercent: null },
    ])).toEqual([
      { situation: 'REGULAR', count: 1 },
      { situation: 'ATTENTION', count: 1 },
      { situation: 'CRITICAL', count: 0 },
      { situation: 'NO_DATA', count: 1 },
    ]);
  });
});

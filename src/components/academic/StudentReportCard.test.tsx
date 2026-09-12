// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudentReportCard from './StudentReportCard';
import { useStudentReportCard } from '../../hooks/useAcademicTermClosing';

vi.mock('../../hooks/useAcademicTermClosing');

describe('StudentReportCard', () => {
  it('mostra apenas dados do aluno atual e PENDING como "Resultado ainda não fechado"', () => {
    (useStudentReportCard as any).mockReturnValue({
      data: {
        studentId: 'student-1',
        subjects: [
          { key: '1', academicYearName: '2023', termName: 'T1', subjectName: 'Math', teacherName: 'John', gradePercentage: null, attendancePercentage: null, resultStatus: 'PENDING', isClosed: false }
        ]
      },
      isLoading: false,
      isError: false,
    });

    render(<StudentReportCard institutionId="inst-1" studentId="student-1" />);
    expect(screen.getByText(/Resultado ainda não fechado/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Imprimir boletim/i })).toBeDefined();
  });

  it('diferencia resultado oficial de resultado parcial', () => {
    (useStudentReportCard as any).mockReturnValue({
      data: {
        studentId: 'student-1',
        closedCount: 1,
        openCount: 0,
        subjects: [
          {
            key: 'closed',
            academicYearName: '2026',
            termName: '1º Bimestre',
            subjectName: 'Matemática',
            teacherName: 'Prof. Ana',
            gradePercentage: 80,
            attendancePercentage: 95,
            resultStatus: 'APPROVED',
            isClosed: true,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });

    render(<StudentReportCard institutionId="inst-1" studentId="student-1" />);

    expect(screen.getByText('Resultado oficial')).toBeDefined();
    expect(screen.getByText('80%')).toBeDefined();
  });
});

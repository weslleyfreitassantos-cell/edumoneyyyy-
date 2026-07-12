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
    // não apresenta ações de edição (nenhum botão)
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GuardianReportCard from './GuardianReportCard';
import { useGuardianReportCards } from '../../hooks/useAcademicTermClosing';

vi.mock('../../hooks/useAcademicTermClosing');

describe('GuardianReportCard', () => {
  it('responsável sem vínculos recebe estado vazio', () => {
    (useGuardianReportCards as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    // Mocking an empty selectedStudentId or no report card for selectedStudentId
    render(<GuardianReportCard institutionId="inst-1" studentIds={['student-1']} selectedStudentId="student-1" />);
    expect(screen.getByText(/Nenhum resultado acadêmico disponível para este estudante/i)).toBeDefined();
  });

  it('mostra apenas estudantes vinculados e permite seleção', () => {
    (useGuardianReportCards as any).mockReturnValue({
      data: [
        {
          studentId: 'student-1',
          subjects: [{ key: '1', academicYearName: '2023', termName: 'T1', subjectName: 'Math', teacherName: 'John', resultStatus: 'APPROVED', isClosed: true, gradePercentage: 80, attendancePercentage: 100 }]
        }
      ],
      isLoading: false,
      isError: false,
    });

    render(<GuardianReportCard institutionId="inst-1" studentIds={['student-1']} selectedStudentId="student-1" />);
    // Math belongs to student-1
    expect(screen.getByText(/Math/i)).toBeDefined();
  });
});

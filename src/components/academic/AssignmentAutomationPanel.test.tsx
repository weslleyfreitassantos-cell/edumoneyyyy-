// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useApplyAssignmentAutomation,
  useAssignmentAutomationPreview,
} from '../../hooks/useAcademicAutomation';

import AssignmentAutomationPanel from './AssignmentAutomationPanel';

vi.mock('../../hooks/useAcademicAutomation', () => ({
  useApplyAssignmentAutomation: vi.fn(),
  useAssignmentAutomationPreview: vi.fn(),
}));

const applyMutation = { mutateAsync: vi.fn(), isPending: false };

const baseProps = {
  institutionId: 'institution-1',
  academicYears: [{ id: 'year-1', institution_id: 'institution-1', name: '2026', start_date: '2026-01-01', end_date: '2026-12-31', active: true, terms: [] }],
  classes: [{ id: 'class-1', institution_id: 'institution-1', academic_year_id: 'year-1', academic_year_name: '2026', name: '1º A', grade_level: '1', shift: 'INTEGRAL', capacity: 30, active: true, active_enrollments_count: 0, active_offerings_count: 0, active_curriculum_items_count: 1, created_at: '2026-01-01', updated_at: '2026-01-01' }],
  subjects: [{ id: 'subject-1', institution_id: 'institution-1', name: 'Matemática', code: 'MAT', workload: null, active: true, active_offerings_count: 0, created_at: '2026-01-01', updated_at: '2026-01-01' }],
  teachers: [{ id: 'teacher-1', profile_id: 'profile-1', institution_id: 'institution-1', active: true, profiles: { full_name: 'Professora Ana', email: 'ana@example.com', avatar_url: null, active: true }, subjects: [] }],
  onClose: vi.fn(),
  onCompleted: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAssignmentAutomationPreview).mockReturnValue({
    data: {
      academicYearId: 'year-1',
      activeTermCount: 4,
      coveredCount: 2,
      candidates: [{ classId: 'class-1', subjectId: 'subject-1', teacherProfileId: 'profile-1', weeklyLessons: 2 }],
      unassigned: [],
    },
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  vi.mocked(useApplyAssignmentAutomation).mockReturnValue(applyMutation as never);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AssignmentAutomationPanel', () => {
  it('exibe a prévia e aplica apenas após confirmação', async () => {
    applyMutation.mutateAsync.mockResolvedValue({ created: 4, candidates: 1, unassigned: 0 });

    render(<AssignmentAutomationPanel {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Atribuir professores automaticamente' })).toBeTruthy();
    expect(screen.getByText('Professora Ana')).toBeTruthy();
    expect(screen.getByText('Prévia das atribuições')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar atribuições' }));

    await waitFor(() => {
      expect(applyMutation.mutateAsync).toHaveBeenCalledWith({ institutionId: 'institution-1', academicYearId: 'year-1' });
      expect(baseProps.onCompleted).toHaveBeenCalledWith('4 atribuição(ões) criada(s) automaticamente.');
      expect(baseProps.onClose).toHaveBeenCalled();
    });
  });
});

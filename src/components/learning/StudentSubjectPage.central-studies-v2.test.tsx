// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const journeys = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>>, isLoading: false, isError: false }));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'profile-1' } }) }));
vi.mock('../../contexts/InstitutionContext', () => ({ useInstitution: () => ({ currentInstitutionId: 'institution-1' }) }));
vi.mock('../../hooks/useLearningCenter', () => ({
  useStudentLearningSubjects: () => ({ data: [{ id: 'subject-math', name: 'Matemática', code: 'MAT' }], isLoading: false, isError: false }),
  useLearningStudent: () => ({ data: { id: 'student-1' } }),
  useGuidedDisciplineJourneysV9: () => journeys,
  useLearningProgress: () => ({ data: [] }),
  useLearningUnits: () => ({ data: [], isLoading: false, isError: false }),
  usePublishedLearningActivities: () => ({ data: [], isLoading: false, isError: false }),
}));

import StudentSubjectPage from './StudentSubjectPage';

afterEach(() => {
  cleanup();
  journeys.data = [];
});

describe('StudentSubjectPage Central Studies V2', () => {
  it('shows only published, mapped, available V2 lessons for the selected enrolled subject', () => {
    journeys.data = [
      {
        source: 'CENTRAL_STUDIES_V2', journey_id: 'published-journey', subject_id: 'subject-math',
        subject_name: 'Matemática', unit_title: 'Números', title: 'Estratégias com números naturais',
        publication_status: 'PUBLISHED', availability_status: 'AVAILABLE', mapping_status: 'MAPPED',
        pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', question_count: 5, progress: 0,
      },
      {
        source: 'CENTRAL_STUDIES_V2', journey_id: 'staging-journey', subject_id: 'subject-math',
        subject_name: 'Matemática', unit_title: 'Números', title: 'Aula ainda em preparação',
        publication_status: 'STAGING', availability_status: 'AVAILABLE', mapping_status: 'MAPPED',
        pedagogical_review_status: 'PEDAGOGICAL_REVIEWED', question_count: 5, progress: 0,
      },
    ];

    render(<MemoryRouter initialEntries={['/student/study/subject/subject-math']}><Routes><Route path="/student/study/subject/:subjectId" element={<StudentSubjectPage />} /></Routes></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Estratégias com números naturais' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Iniciar aula' })).toHaveProperty('href', expect.stringContaining('/student/study/guided?journey=published-journey'));
    expect(screen.queryByText('Aula ainda em preparação')).toBeNull();
  });
});

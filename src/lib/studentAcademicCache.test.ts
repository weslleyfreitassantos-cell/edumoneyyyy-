// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  hydrateStudentAcademicCache,
  subscribeToStudentAcademicCache,
} from './studentAcademicCache';

describe('student academic session cache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('restores the report card after a full page refresh', () => {
    const firstClient = new QueryClient();
    const stopListening = subscribeToStudentAcademicCache(
      firstClient,
      'profile-1',
      'institution-1',
    );
    const reportCard = {
      studentId: 'student-1',
      subjects: [{ subjectName: 'Matemática' }],
    };

    firstClient.setQueryData(
      ['academic-closing', 'report-card', 'institution-1', 'student-1'],
      reportCard,
    );
    stopListening();

    const refreshedClient = new QueryClient();
    hydrateStudentAcademicCache(
      refreshedClient,
      'profile-1',
      'institution-1',
    );

    expect(
      refreshedClient.getQueryData([
        'academic-closing',
        'report-card',
        'institution-1',
        'student-1',
      ]),
    ).toEqual(reportCard);
  });
});

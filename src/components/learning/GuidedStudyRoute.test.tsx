// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('./GuidedJourneyPage', () => ({ default: () => <p>Jornada V11</p> }));
vi.mock('./LegacyGuidedJourneyPage', () => ({ default: () => <p>Jornada legada</p> }));

import GuidedStudyRoute from './GuidedStudyRoute';

function renderRoute(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/student/study/guided" element={<GuidedStudyRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('GuidedStudyRoute', () => {
  it('opens the V11 session when a session id is present', () => {
    renderRoute('/student/study/guided?session=session-1&subject=subject-1');

    expect(screen.getByText('Jornada V11')).toBeTruthy();
    expect(screen.queryByText('Jornada legada')).toBeNull();
  });

  it('preserves the legacy guided journey when there is no V11 session id', () => {
    renderRoute('/student/study/guided');

    expect(screen.getByText('Jornada legada')).toBeTruthy();
    expect(screen.queryByText('Jornada V11')).toBeNull();
  });
});

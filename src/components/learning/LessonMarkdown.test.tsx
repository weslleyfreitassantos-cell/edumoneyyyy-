// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LessonMarkdown from './LessonMarkdown';

describe('LessonMarkdown', () => {
  it('renders markdown headings as semantic headings without injecting HTML', () => {
    render(<LessonMarkdown content={'## Como ler uma variação\n\nObserve os eixos.'} />);

    expect(screen.getByRole('heading', { name: 'Como ler uma variação' })).toBeTruthy();
    expect(screen.getByText('Observe os eixos.')).toBeTruthy();
    expect(screen.queryByText('## Como ler uma variação')).toBeNull();
  });
});

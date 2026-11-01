// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import unitedStatesFlag from '../../assets/flags/us.svg';
import spainFlag from '../../assets/flags/es.svg';
import southKoreaFlag from '../../assets/flags/kr.svg';
import type { EnglishCourseMap } from '../../services/tecEnglishService';
import type { TecLanguageLocale } from '../../lib/tecLanguage';

vi.mock('../../services/tecEnglishService', () => ({
  tecLanguageDisplayName: (code?: string) => code?.includes('SPANISH') ? 'Espanhol' : code?.includes('KOREAN') ? 'Coreano' : 'Inglês',
  tecLanguageLocale: (code?: string) => code?.includes('SPANISH') ? 'es-ES' : code?.includes('KOREAN') ? 'ko-KR' : 'en-US',
}));

import LanguageCourseSwitcher from './LanguageCourseSwitcher';

const languages: Array<{ code: string; locale: TecLanguageLocale; name: string; flag: string }> = [
  { code: 'TEC_ENGLISH_FOUNDATIONS_V2', locale: 'en-US', name: 'Inglês', flag: unitedStatesFlag },
  { code: 'TEC_SPANISH_FOUNDATIONS_V1', locale: 'es-ES', name: 'Espanhol', flag: spainFlag },
  { code: 'TEC_KOREAN_FOUNDATIONS_V1', locale: 'ko-KR', name: 'Coreano', flag: southKoreaFlag },
];

function courseMap(code: string): EnglishCourseMap {
  return {
    course: {
      code,
      title: code,
      description: '',
      version: 1,
      publication_status: 'STAGING',
      review_status: 'PEDAGOGICAL_REVIEW_PENDING',
    },
    units: [],
    stats: { xp: 0, current_streak: 0, longest_streak: 0, last_study_date: null },
    completed_lessons: 0,
    total_lessons: 0,
    continue_lesson_id: null,
  };
}

const courses = languages.map(({ code }) => courseMap(code));

afterEach(() => cleanup());

describe('LanguageCourseSwitcher flags', () => {
  it.each(languages)('shows the real $name SVG in the closed trigger', ({ code, locale, name, flag }) => {
    const { container } = render(
      <LanguageCourseSwitcher courses={courses} selectedLanguage={locale} onSelect={vi.fn()} />,
    );

    const trigger = screen.getByRole('button', { name: `Escolher idioma: ${name}` });
    const image = trigger.querySelector('img');
    expect(image?.getAttribute('src')).toBe(flag);
    expect(image?.getAttribute('alt')).toBe('');
    expect(trigger.textContent).not.toMatch(/\b(?:US|ES|KR)\b/);
    expect(container.firstElementChild?.className).toContain('w-full');
  });

  it('shows the matching local SVG beside every language and keeps accessible option names', () => {
    render(
      <LanguageCourseSwitcher courses={courses} selectedLanguage="en-US" onSelect={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Escolher idioma: Inglês' }));

    for (const { locale, name, flag } of languages) {
      const option = screen.getByRole('option', { name: new RegExp(`^${name},`) });
      expect(option.getAttribute('aria-selected')).toBe(locale === 'en-US' ? 'true' : 'false');
      expect(option.querySelector('img')?.getAttribute('src')).toBe(flag);
      expect(option.textContent).not.toMatch(/\b(?:US|ES|KR)\b/);
    }

    expect(screen.getByRole('listbox', { name: 'Meus idiomas' })).toBeTruthy();
  });

  it('preserves keyboard selection, accessible trigger state, and compact responsive sizing', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <LanguageCourseSwitcher courses={courses} selectedLanguage="en-US" onSelect={onSelect} />,
    );
    const trigger = screen.getByRole('button', { name: 'Escolher idioma: Inglês' });

    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.className).toContain('sm:w-auto');
    expect(trigger.className).toContain('w-full');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const korean = screen.getByRole('option', { name: /^Coreano,/ });
    fireEvent.click(korean);

    expect(onSelect).toHaveBeenCalledWith('ko-KR');
    expect(screen.getByRole('button', { name: 'Escolher idioma: Inglês' }).getAttribute('aria-expanded')).toBe('false');
  });
});

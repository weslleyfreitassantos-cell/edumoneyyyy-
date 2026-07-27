// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { curriculumKeys } from './useCurriculum';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('curriculumKeys', () => {
  it('gera chave all', () => {
    expect(curriculumKeys.all).toEqual(['curriculum']);
  });

  it('gera chave list para instituicao', () => {
    expect(curriculumKeys.list('inst-1')).toEqual(['curriculum', 'inst-1']);
  });
});

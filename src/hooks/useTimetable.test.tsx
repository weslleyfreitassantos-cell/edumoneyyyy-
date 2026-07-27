// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { timetableKeys } from './useTimetable';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('timetableKeys', () => {
  it('gera chave all', () => {
    expect(timetableKeys.all).toEqual(['timetable']);
  });

  it('gera chave rooms para instituicao', () => {
    expect(timetableKeys.rooms('inst-1')).toEqual(['timetable', 'rooms', 'inst-1']);
  });

  it('gera chave entries para instituicao', () => {
    expect(timetableKeys.entries('inst-1')).toEqual(['timetable', 'entries', 'inst-1']);
  });
});

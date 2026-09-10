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

  it('gera chave de status do calendario por contexto e data', () => {
    expect(timetableKeys.calendarStatus('inst-1|2026-09-07|year-1|class-1|subject-1')).toEqual([
      'timetable',
      'calendar-status',
      'inst-1|2026-09-07|year-1|class-1|subject-1',
    ]);
  });
});

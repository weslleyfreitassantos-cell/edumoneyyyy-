import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { classCouncilService } from './classCouncilService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

function queryBuilder(data: unknown[]) {
  const builder: Record<string, any> = {};
  for (const method of ['select', 'eq', 'in', 'order']) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve({ data, error: null }));
  return builder;
}

describe('classCouncilService.listEligibleParticipants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns staff and only teachers assigned to the selected class and term', async () => {
    const memberships = queryBuilder([
      { institution_id: 'institution-1', profile_id: 'director-1', role: 'DIRECTOR', active: true, profiles: { full_name: 'Diretor', email: 'director@example.com', active: true } },
      { institution_id: 'institution-1', profile_id: 'secretary-1', role: 'SECRETARY', active: true, profiles: { full_name: 'Secretaria', email: 'secretary@example.com', active: true } },
      { institution_id: 'institution-1', profile_id: 'teacher-assigned', role: 'TEACHER', active: true, profiles: { full_name: 'Professor A', email: 'a@example.com', active: true } },
      { institution_id: 'institution-1', profile_id: 'teacher-other-class', role: 'TEACHER', active: true, profiles: { full_name: 'Professor B', email: 'b@example.com', active: true } },
      { institution_id: 'institution-1', profile_id: 'teacher-other-term', role: 'TEACHER', active: true, profiles: { full_name: 'Professor C', email: 'c@example.com', active: true } },
      { institution_id: 'institution-1', profile_id: 'teacher-inactive', role: 'TEACHER', active: false, profiles: { full_name: 'Professor Inativo', email: 'inactive@example.com', active: true } },
      { institution_id: 'institution-2', profile_id: 'teacher-foreign', role: 'TEACHER', active: true, profiles: { full_name: 'Professor Externo', email: 'foreign@example.com', active: true } },
      { institution_id: 'institution-1', profile_id: 'teacher-profile-inactive', role: 'TEACHER', active: true, profiles: { full_name: 'Perfil Inativo', email: 'profile-inactive@example.com', active: false } },
    ]);
    const offerings = queryBuilder([
      { teacher_profile_id: 'teacher-assigned' },
      { teacher_profile_id: 'teacher-assigned' },
    ]);
    vi.mocked(supabase.from).mockImplementation(((table: string) => table === 'memberships' ? memberships : offerings) as never);

    const result = await classCouncilService.listEligibleParticipants('institution-1', 'class-1', 'term-1');

    expect(result).toEqual([
      { profileId: 'director-1', profileName: 'Diretor', profileEmail: 'director@example.com', role: 'DIRECTOR' },
      { profileId: 'secretary-1', profileName: 'Secretaria', profileEmail: 'secretary@example.com', role: 'SECRETARY' },
      { profileId: 'teacher-assigned', profileName: 'Professor A', profileEmail: 'a@example.com', role: 'TEACHER' },
    ]);
    expect(memberships.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(memberships.eq).toHaveBeenCalledWith('active', true);
    expect(memberships.eq).toHaveBeenCalledWith('profiles.active', true);
    expect(offerings.eq).toHaveBeenCalledWith('class_id', 'class-1');
    expect(offerings.eq).toHaveBeenCalledWith('term_id', 'term-1');
    expect(offerings.eq).toHaveBeenCalledWith('active', true);
  });

  it('deduplicates a teacher assigned to multiple subjects', async () => {
    const memberships = queryBuilder([
      { institution_id: 'institution-1', profile_id: 'teacher-1', role: 'TEACHER', active: true, profiles: { full_name: 'Professor', email: 'teacher@example.com', active: true } },
    ]);
    const offerings = queryBuilder([
      { teacher_profile_id: 'teacher-1' },
      { teacher_profile_id: 'teacher-1' },
    ]);
    vi.mocked(supabase.from).mockImplementation(((table: string) => table === 'memberships' ? memberships : offerings) as never);

    const result = await classCouncilService.listEligibleParticipants('institution-1', 'class-1', 'term-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.profileId).toBe('teacher-1');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: mocks.from },
}));

import { listInclusiveStudents } from './inclusiveEducationService';

type QueryResponse = {
  data: unknown[] | null;
  error: Error | null;
};

function queryBuilder(response: QueryResponse) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return builder;
}

describe('listInclusiveStudents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes active student records to the requested institution and maps names', async () => {
    const query = queryBuilder({
      data: [
        { id: 'student-1', profile: { full_name: 'Ana Souza' } },
        { id: 'student-2', profile: null },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(query);

    await expect(listInclusiveStudents('institution-1')).resolves.toEqual([
      { id: 'student-1', name: 'Ana Souza' },
      { id: 'student-2', name: 'Estudante sem nome' },
    ]);

    expect(mocks.from).toHaveBeenCalledWith('students');
    expect(query.select).toHaveBeenCalledWith('id,profile:profiles(full_name)');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'institution_id', 'institution-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'active', true);
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('propagates database errors rather than returning an empty roster', async () => {
    const error = new Error('institution query failed');
    mocks.from.mockReturnValue(queryBuilder({ data: null, error }));

    await expect(listInclusiveStudents('institution-1')).rejects.toBe(error);
  });
});

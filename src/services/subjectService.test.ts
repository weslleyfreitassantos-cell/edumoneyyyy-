import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { supabase } from '../lib/supabaseClient';

import { subjectService } from './subjectService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const currentSubject = {
  id: 'subject-1',
  institution_id: 'institution-1',
  name: 'Língua Portuguesa',
  code: 'LP',
  workload: null,
  active: true,
  created_at: null,
  updated_at: null,
};

const createdSubject = {
  id: 'subject-2',
  institution_id: 'institution-1',
  name: 'Arte',
  code: 'ART',
  workload: null,
  active: true,
  created_at: null,
  updated_at: null,
};

function mockSubjectTable({
  current = [],
  created = [],
}: {
  current?: unknown[];
  created?: unknown[];
} = {}) {
  const eq = vi.fn().mockResolvedValue({
    data: current,
    error: null,
  });
  const selectCurrent = vi.fn().mockReturnValue({
    eq,
  });
  const selectCreated = vi.fn().mockResolvedValue({
    data: created,
    error: null,
  });
  const insert = vi.fn().mockReturnValue({
    select: selectCreated,
  });

  vi.mocked(supabase.from).mockReturnValue({
    select: selectCurrent,
    insert,
  } as never);

  return {
    eq,
    insert,
    selectCurrent,
    selectCreated,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subjectService.createManyMissing', () => {
  it('insere somente ausentes e retorna criadas e ignoradas', async () => {
    const table = mockSubjectTable({
      current: [currentSubject],
      created: [createdSubject],
    });

    const result =
      await subjectService.createManyMissing({
        institutionId: 'institution-1',
        subjects: [
          {
            name: ' língua portuguesa ',
            code: 'LP',
          },
          {
            name: 'Arte',
            code: 'art',
          },
        ],
      });

    expect(table.eq).toHaveBeenCalledWith(
      'institution_id',
      'institution-1',
    );
    expect(table.insert).toHaveBeenCalledWith([
      {
        institution_id: 'institution-1',
        name: 'Arte',
        code: 'ART',
        workload: null,
        active: true,
      },
    ]);
    expect(result.created).toHaveLength(1);
    expect(result.created[0].name).toBe('Arte');
    expect(result.skipped).toEqual([
      {
        name: 'língua portuguesa',
        reason: 'NAME_EXISTS',
      },
    ]);
  });

  it('nao duplica por nome ignorando maiusculas e minusculas', async () => {
    const table = mockSubjectTable({
      current: [currentSubject],
    });

    const result =
      await subjectService.createManyMissing({
        institutionId: 'institution-1',
        subjects: [
          {
            name: '  LÍNGUA PORTUGUESA ',
            code: 'LP2',
          },
        ],
      });

    expect(table.insert).not.toHaveBeenCalled();
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual([
      {
        name: 'LÍNGUA PORTUGUESA',
        reason: 'NAME_EXISTS',
      },
    ]);
  });

  it('normaliza espacos nas bordas ao comparar nomes', async () => {
    const table = mockSubjectTable({
      current: [currentSubject],
    });

    const result =
      await subjectService.createManyMissing({
        institutionId: 'institution-1',
        subjects: [
          {
            name: ' Língua Portuguesa ',
            code: 'LP2',
          },
        ],
      });

    expect(table.insert).not.toHaveBeenCalled();
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual([
      {
        name: 'Língua Portuguesa',
        reason: 'NAME_EXISTS',
      },
    ]);
  });

  it('nao duplica por codigo ignorando maiusculas e minusculas', async () => {
    const table = mockSubjectTable({
      current: [currentSubject],
    });

    const result =
      await subjectService.createManyMissing({
        institutionId: 'institution-1',
        subjects: [
          {
            name: 'Literatura',
            code: ' lp ',
          },
        ],
      });

    expect(table.insert).not.toHaveBeenCalled();
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toEqual([
      {
        name: 'Literatura',
        reason: 'CODE_EXISTS',
      },
    ]);
  });

  it('mantem institution_id correto e nao mistura instituicoes', async () => {
    const table = mockSubjectTable({
      current: [],
      created: [
        {
          ...createdSubject,
          institution_id: 'institution-2',
        },
      ],
    });

    await subjectService.createManyMissing({
      institutionId: 'institution-2',
      subjects: [
        {
          name: 'Arte',
          code: 'ART',
        },
      ],
    });

    expect(table.eq).toHaveBeenCalledWith(
      'institution_id',
      'institution-2',
    );
    expect(table.insert).toHaveBeenCalledWith([
      {
        institution_id: 'institution-2',
        name: 'Arte',
        code: 'ART',
        workload: null,
        active: true,
      },
    ]);
  });

  it('segunda execucao cria zero duplicatas', async () => {
    const eq = vi
      .fn()
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [createdSubject],
        error: null,
      });
    const selectCurrent =
      vi.fn().mockReturnValue({ eq });
    const selectCreated =
      vi.fn().mockResolvedValue({
        data: [createdSubject],
        error: null,
      });
    const insert = vi.fn().mockReturnValue({
      select: selectCreated,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: selectCurrent,
      insert,
    } as never);

    const input = {
      institutionId: 'institution-1',
      subjects: [
        {
          name: 'Arte',
          code: 'ART',
        },
      ],
    };

    const first =
      await subjectService.createManyMissing(input);
    const second =
      await subjectService.createManyMissing(input);

    expect(first.created).toHaveLength(1);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toEqual([
      {
        name: 'Arte',
        reason: 'NAME_EXISTS',
      },
    ]);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

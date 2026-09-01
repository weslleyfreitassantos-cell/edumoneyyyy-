import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';

import {
  timetableEntrySchema,
  roomSchema,
} from '../schemas/adminSchemas';

import {
  timetableService,
  DAYS_OF_WEEK,
  dayLabel,
  type TimetableEntryRow,
  type RoomRow,
} from './timetableService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const UUID = '00000000-0000-0000-0000-000000000000';
const baseRoom = {
  id: UUID,
  institution_id: UUID,
  name: 'Sala 01',
  code: 'S01',
  capacity: 30,
  active: true,
  created_at: null,
  updated_at: null,
};

const baseEntry = {
  id: UUID,
  institution_id: UUID,
  subject_offering_id: UUID,
  room_id: UUID,
  day_of_week: 2,
  start_time: '07:00',
  end_time: '07:50',
  active: true,
  created_at: null,
  updated_at: null,
  subject_offerings: {
    class_id: UUID,
    teacher_profile_id: UUID,
    classes: { name: '1A' },
    subjects: { name: 'Português' },
    profiles: { full_name: 'Prof Silva' },
  },
  rooms: { name: 'Sala 01' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSupabaseOnce(handlers: Record<string, (...args: unknown[]) => unknown>) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const [method, impl] of Object.entries(handlers)) {
    builder[method] = vi.fn(impl);
  }
  vi.mocked(supabase.from).mockReturnValue(builder as never);
}

describe('timetableService.listRooms', () => {
  it('retorna salas de uma instituicao', async () => {
    mockSupabaseOnce({
      select: () => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [baseRoom], error: null }),
        })),
      }),
    });
    const result = await timetableService.listRooms(UUID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Sala 01');
  });

  it('retorna lista vazia quando nao ha salas', async () => {
    mockSupabaseOnce({
      select: () => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      }),
    });
    const result = await timetableService.listRooms(UUID);
    expect(result).toEqual([]);
  });
});

describe('timetableService.createRoom', () => {
  it('cria sala com dados validos', async () => {
    const single = vi.fn().mockResolvedValue({ data: baseRoom, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    const result = await timetableService.createRoom({
      institution_id: UUID,
      name: 'Sala 01',
      code: 'S01',
      capacity: 30,
      active: true,
    });
    expect(result.name).toBe('Sala 01');
  });
});

describe('timetableService.updateRoom', () => {
  it('atualiza nome da sala', async () => {
    const eq2 = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await timetableService.updateRoom(UUID, UUID, { name: 'Sala 02', code: 'S02', active: true });
    expect(update).toHaveBeenCalled();
  });
});

describe('timetableService.listEntries', () => {
  it('retorna entradas da grade', async () => {
    mockSupabaseOnce({
      select: () => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [baseEntry], error: null }),
          })),
        })),
      }),
    });
    const result = await timetableService.listEntries(UUID);
    expect(result).toHaveLength(1);
    expect(result[0].subject_name).toBe('Português');
    expect(result[0].teacher_name).toBe('Prof Silva');
    expect(result[0].room_name).toBe('Sala 01');
  });

  it('filtra entradas com offering nulo', async () => {
    const brokenEntry = { ...baseEntry, subject_offerings: null };
    mockSupabaseOnce({
      select: () => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [brokenEntry], error: null }),
          })),
        })),
      }),
    });
    const result = await timetableService.listEntries(UUID);
    expect(result).toHaveLength(0);
  });
});

describe('timetableService.listByClass', () => {
  it('mantem somente os horarios da turma solicitada', async () => {
    const otherClassEntry = {
      ...baseEntry,
      id: 'other-entry',
      subject_offerings: {
        ...baseEntry.subject_offerings,
        class_id: 'other-class',
      },
    };

    const order = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [baseEntry, otherClassEntry],
        error: null,
      }),
    }));
    const classFilter = vi.fn(() => ({ order }));
    const activeFilter = vi.fn(() => ({ eq: classFilter }));
    const institutionFilter = vi.fn(() => ({ eq: activeFilter }));
    const select = vi.fn(() => ({ eq: institutionFilter }));
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const result = await timetableService.listByClass(
      UUID,
      UUID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].class_id).toBe(UUID);
    expect(institutionFilter).toHaveBeenCalledWith('institution_id', UUID);
    expect(activeFilter).toHaveBeenCalledWith('active', true);
    expect(classFilter).toHaveBeenCalledWith(
      'subject_offerings.class_id',
      UUID,
    );
  });

  it('limita a grade da turma ao periodo informado', async () => {
    const eq3 = vi.fn(() => ({
      order: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({
          data: [baseEntry],
          error: null,
        }),
      })),
    }));
    const classFilter = vi.fn(() => ({ eq: eq3 }));
    const activeFilter = vi.fn(() => ({ eq: classFilter }));
    const institutionFilter = vi.fn(() => ({ eq: activeFilter }));
    const select = vi.fn(() => ({ eq: institutionFilter }));
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    await timetableService.listByClass(UUID, UUID, 'term-current');

    expect(eq3).toHaveBeenCalledWith('term_id', 'term-current');
  });
});

describe('timetableService.createEntry', () => {
  it('cria entrada com dados validos', async () => {
    const single = vi.fn().mockResolvedValue({ data: baseEntry, error: null });
    const selectFn = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    const result = await timetableService.createEntry({
      institution_id: UUID,
      subject_offering_id: UUID,
      room_id: UUID,
      day_of_week: 2,
      start_time: '07:00',
      end_time: '07:50',
      active: true,
    });
    expect(result.subject_name).toBe('Português');
  });

  it.each([
    ['ROOM_ALREADY_BOOKED', new Error('ROOM_ALREADY_BOOKED'), 'A sala já está ocupada neste horário.'],
    ['TEACHER_ALREADY_BOOKED', { message: 'TEACHER_ALREADY_BOOKED', code: 'P0001', details: null, hint: null }, 'O professor já possui aula neste horário.'],
    ['CLASS_ALREADY_BOOKED', { message: 'CLASS_ALREADY_BOOKED', code: 'P0001', details: null, hint: null }, 'A turma já possui aula neste horário.'],
  ])('mapeia %s com erro amigavel', async (_label, err, expectedMessage) => {
    const single = vi.fn().mockResolvedValue({ data: null, error: err });
    const selectFn = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await expect(
      timetableService.createEntry({
        institution_id: UUID,
        subject_offering_id: UUID,
        day_of_week: 2,
        start_time: '07:00',
        end_time: '07:50',
        active: true,
      }),
    ).rejects.toThrow(expectedMessage);
  });

  it('mapeia RLS 42501 em createEntry com mensagem amigavel', async () => {
    const err = { message: 'new row violates row-level security policy for table "timetable_entries"', code: '42501', details: null, hint: null };
    const single = vi.fn().mockResolvedValue({ data: null, error: err });
    const selectFn = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await expect(
      timetableService.createEntry({
        institution_id: UUID,
        subject_offering_id: UUID,
        day_of_week: 2,
        start_time: '07:00',
        end_time: '07:50',
        active: true,
      }),
    ).rejects.toThrow('Você não tem permissão para alterar a grade horária desta instituição.');
  });

  it('mapeia RLS 42501 em createRoom com mensagem amigavel', async () => {
    const err = { message: 'new row violates row-level security policy for table "rooms"', code: '42501', details: null, hint: null };
    const single = vi.fn().mockResolvedValue({ data: null, error: err });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await expect(
      timetableService.createRoom({
        institution_id: UUID,
        name: 'Sala 01',
        code: 'S01',
        capacity: 30,
        active: true,
      }),
    ).rejects.toThrow('Você não tem permissão para alterar a grade horária desta instituição.');
  });

  it('mapeia erro desconhecido como mensagem generica', async () => {
    const err = { message: 'some internal database error', code: 'XXXXX', details: null, hint: null };
    const single = vi.fn().mockResolvedValue({ data: null, error: err });
    const selectFn = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await expect(
      timetableService.createEntry({
        institution_id: UUID,
        subject_offering_id: UUID,
        day_of_week: 2,
        start_time: '07:00',
        end_time: '07:50',
        active: true,
      }),
    ).rejects.toThrow('Não foi possível concluir a operação.');
  });
});

describe('timetableService.buildGrid', () => {
  const entry1: TimetableEntryRow = {
    id: 'e1', institution_id: UUID, subject_offering_id: UUID, class_id: 'class-1', academic_year_id: 'year-1', term_id: 'term-1', subject_id: 'subject-1', teacher_profile_id: 'teacher-1', room_id: UUID, room_name: 'Sala 01',
    day_of_week: 2, day_label: 'Terça', start_time: '07:00', end_time: '07:50',
    active: true, class_name: '1A', subject_name: 'Português', teacher_name: 'Prof Silva',
  };
  const entry2: TimetableEntryRow = {
    id: 'e2', institution_id: UUID, subject_offering_id: UUID, class_id: 'class-1', academic_year_id: 'year-1', term_id: 'term-1', subject_id: 'subject-2', teacher_profile_id: 'teacher-2', room_id: null, room_name: null,
    day_of_week: 2, day_label: 'Terça', start_time: '07:50', end_time: '08:40',
    active: true, class_name: '1A', subject_name: 'Matemática', teacher_name: 'Prof Souza',
  };
  const entry3: TimetableEntryRow = {
    id: 'e3', institution_id: UUID, subject_offering_id: UUID, class_id: 'class-1', academic_year_id: 'year-1', term_id: 'term-1', subject_id: 'subject-1', teacher_profile_id: 'teacher-1', room_id: null, room_name: null,
    day_of_week: 3, day_label: 'Quarta', start_time: '07:00', end_time: '07:50',
    active: true, class_name: '1A', subject_name: 'Português', teacher_name: 'Prof Silva',
  };

  it('cria grid com slots de tempo e dias', () => {
    const grid = timetableService.buildGrid([entry1, entry2, entry3]);
    expect(grid.timeSlots).toHaveLength(2);
    expect(grid.days).toHaveLength(6);
    expect(grid.days[1].slots[0].entries).toHaveLength(1);
    expect(grid.days[1].slots[1].entries).toHaveLength(1);
    expect(grid.days[2].slots[0].entries).toHaveLength(1);
  });

  it('ordena slots por horario', () => {
    const grid = timetableService.buildGrid([entry2, entry1]);
    expect(grid.timeSlots[0].start_time).toBe('07:00');
    expect(grid.timeSlots[1].start_time).toBe('07:50');
  });

  it('nao inclui entradas inativas na grid', () => {
    const inactive = { ...entry1, active: false, id: 'e4' };
    const grid = timetableService.buildGrid([inactive]);
    const entriesOnDay = grid.days[1].slots[0].entries;
    expect(entriesOnDay).toHaveLength(0);
  });

  it('retorna grid vazia para lista vazia', () => {
    const grid = timetableService.buildGrid([]);
    expect(grid.timeSlots).toHaveLength(0);
    expect(grid.days).toHaveLength(6);
    for (const day of grid.days) {
      expect(day.slots).toHaveLength(0);
    }
  });
});

describe('timetable entry schema', () => {
  it('aceita dados validos', () => {
    const result = timetableEntrySchema.safeParse({
      institution_id: UUID,
      subject_offering_id: UUID,
      room_id: UUID,
      day_of_week: 2,
      start_time: '07:00',
      end_time: '07:50',
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita end_time anterior a start_time', () => {
    const result = timetableEntrySchema.safeParse({
      institution_id: UUID,
      subject_offering_id: UUID,
      day_of_week: 2,
      start_time: '08:00',
      end_time: '07:00',
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita day_of_week invalido', () => {
    const result = timetableEntrySchema.safeParse({
      institution_id: UUID,
      subject_offering_id: UUID,
      day_of_week: 7,
      start_time: '07:00',
      end_time: '07:50',
      active: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('room schema', () => {
  it('aceita dados validos', () => {
    const result = roomSchema.safeParse({
      institution_id: UUID,
      name: 'Sala 01',
      code: 'S01',
      capacity: 30,
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita nome vazio', () => {
    const result = roomSchema.safeParse({
      institution_id: UUID,
      name: '',
      active: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('dayLabel e DAYS_OF_WEEK', () => {
  it('retorna labels corretos para dias 1-6', () => {
    expect(dayLabel(1)).toBe('Segunda');
    expect(dayLabel(2)).toBe('Terça');
    expect(dayLabel(3)).toBe('Quarta');
    expect(dayLabel(4)).toBe('Quinta');
    expect(dayLabel(5)).toBe('Sexta');
    expect(dayLabel(6)).toBe('Sábado');
  });

  it('retorna string vazia para dia invalido', () => {
    expect(dayLabel(0)).toBe('');
    expect(dayLabel(7)).toBe('');
  });

  it('DAYS_OF_WEEK contem 1 a 6', () => {
    expect(DAYS_OF_WEEK).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

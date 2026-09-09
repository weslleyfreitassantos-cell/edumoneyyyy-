import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  academicCalendarService,
  type AcademicCalendarEventInput,
  validateAcademicCalendarInput,
} from './academicCalendarService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function queryBuilder(data: unknown[] = []) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>;

  for (const method of ['select', 'eq', 'gte', 'lt', 'or', 'order', 'limit', 'insert', 'update']) {
    builder[method].mockReturnValue(builder);
  }
  builder.single.mockResolvedValue({ data: data[0] ?? null, error: null });
  builder.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data, error: null })));

  return builder;
}

const validInput: AcademicCalendarEventInput = {
  institution_id: 'institution-1',
  created_by: 'profile-1',
  title: 'Reunião de responsáveis',
  description: 'Encontro no auditório.',
  event_type: 'MEETING',
  starts_at: '2026-09-15T08:00',
  ends_at: '2026-09-15T09:00',
  all_day: false,
  audience: 'GUARDIANS',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('academicCalendarService', () => {
  it('lista eventos filtrando pela instituição atual', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await academicCalendarService.listForStaff('institution-1');

    expect(supabase.from).toHaveBeenCalledWith('academic_calendar_events');
    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
  });

  it('filtra por sobreposição quando a data está dentro de um intervalo', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await academicCalendarService.listForStaff('institution-1', { date: '2026-07-15' });

    expect(query.lt).toHaveBeenCalledWith('starts_at', '2026-07-16T00:00:00.000Z');
    expect(query.or).toHaveBeenCalledWith('ends_at.gte.2026-07-15T00:00:00.000Z,and(ends_at.is.null,starts_at.gte.2026-07-15T00:00:00.000Z)');
  });

  it('cria um evento válido', async () => {
    const query = queryBuilder([{
      id: 'event-1',
      institution_id: 'institution-1',
      academic_year_id: null,
      title: validInput.title,
      description: validInput.description,
      event_type: validInput.event_type,
      starts_at: '2026-09-15T11:00:00.000Z',
      ends_at: '2026-09-15T12:00:00.000Z',
      all_day: false,
      audience: validInput.audience,
      class_id: null,
      subject_id: null,
      active: true,
      created_by: 'profile-1',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
      classes: null,
      subjects: null,
    }]);
    vi.mocked(supabase.from).mockReturnValue(query as never);

    const result = await academicCalendarService.create(validInput);

    expect(result.id).toBe('event-1');
    expect(query.insert).toHaveBeenCalledOnce();
  });

  it('rejeita período inválido antes de consultar o banco', async () => {
    expect(() => validateAcademicCalendarInput({
      ...validInput,
      ends_at: '2026-09-14T09:00',
    })).toThrow('A data final não pode ser anterior ao início.');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('exige class_id para o público de uma turma', () => {
    expect(() => validateAcademicCalendarInput({
      ...validInput,
      audience: 'CLASS',
      class_id: null,
    })).toThrow('Selecione uma turma para este público.');
  });

  it('aplica active=true na consulta de eventos públicos futuros', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await academicCalendarService.listUpcomingForAudience('institution-1');

    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(query.eq).toHaveBeenCalledWith('active', true);
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining('starts_at.gte.'));
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining('and(all_day.eq.true,starts_at.gte.'));
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining('and(all_day.eq.true,ends_at.gte.'));
    expect(query.limit).toHaveBeenCalledWith(5);
  });
});

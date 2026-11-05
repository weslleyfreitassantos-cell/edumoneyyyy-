import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  academicCalendarService,
  fetchBrazilianNationalHolidays,
  type AcademicCalendarEventInput,
  type ReenrollmentCalendarSettings,
  validateAcademicCalendarInput,
} from './academicCalendarService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

function queryBuilder(data: unknown[] = []) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>;

  for (const method of ['select', 'eq', 'gte', 'lt', 'or', 'in', 'order', 'limit', 'insert', 'update']) {
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

const reenrollmentSettings: ReenrollmentCalendarSettings = {
  source_academic_year_id: 'year-2026',
  destination_academic_year_id: 'year-2027',
  eligible_grade_levels: ['8º ano', '9º ano'],
  contract_version: 'v2',
  contract_body: 'Este é o contrato completo de rematrícula para o próximo ano.',
  finance_mode: 'MANUAL',
  show_future_notice: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('academicCalendarService', () => {
  it('consulta os bloqueios da data no contexto informado', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ event_id: 'event-1', event_type: 'HOLIDAY' }],
      error: null,
    } as never);

    const status = await academicCalendarService.getAcademicDateStatus({
      institutionId: 'institution-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      subjectId: 'subject-1',
    }, '2026-09-15');

    expect(supabase.rpc).toHaveBeenCalledWith('get_academic_day_blockers', {
      p_institution_id: 'institution-1',
      p_date: '2026-09-15',
      p_academic_year_id: 'year-1',
      p_class_id: 'class-1',
      p_subject_id: 'subject-1',
    });
    expect(status).toEqual({
      date: '2026-09-15',
      state: 'BLOCKED',
      blocked: true,
      blockers: [{ event_id: 'event-1', event_type: 'HOLIDAY' }],
    });
  });

  it('rejeita data civil inválida antes da RPC', async () => {
    await expect(academicCalendarService.getAcademicDateStatus({
      institutionId: 'institution-1',
    }, '15/09/2026')).rejects.toThrow('Informe uma data civil válida.');

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('rejeita instituição vazia antes da RPC', async () => {
    await expect(academicCalendarService.getAcademicDateStatus({
      institutionId: ' ',
    }, '2026-09-15')).rejects.toThrow('A instituição é obrigatória');

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('lista eventos filtrando pela instituição atual', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await academicCalendarService.listForStaff('institution-1');

    expect(supabase.from).toHaveBeenCalledWith('academic_calendar_events');
    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
  });

  it('consulta os feriados nacionais da BrasilAPI', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' },
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBrazilianNationalHolidays(2026)).resolves.toEqual([
      { date: '2026-01-01', name: 'Confraternização mundial', type: 'national', weekday: undefined },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/feriados/v1/2026',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('importa feriados em lote e ignora datas já cadastradas', async () => {
    const existingQuery = queryBuilder([{
      id: 'holiday-1',
      institution_id: 'institution-1',
      academic_year_id: 'year-1',
      title: 'Confraternização mundial',
      description: null,
      event_type: 'HOLIDAY',
      starts_at: '2026-01-01T00:00:00.000Z',
      ends_at: null,
      all_day: true,
      audience: 'ALL',
      class_id: null,
      subject_id: null,
      active: true,
      created_by: 'profile-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      classes: null,
      subjects: null,
    }]);
    const insertQuery = queryBuilder([{
      id: 'holiday-2',
      institution_id: 'institution-1',
      academic_year_id: 'year-1',
      title: 'Carnaval',
      description: 'Feriado nacional importado automaticamente para 2026.',
      event_type: 'HOLIDAY',
      starts_at: '2026-02-16T00:00:00.000Z',
      ends_at: null,
      all_day: true,
      audience: 'ALL',
      class_id: null,
      subject_id: null,
      active: true,
      created_by: 'profile-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      classes: null,
      subjects: null,
    }]);
    vi.mocked(supabase.from)
      .mockReturnValueOnce(existingQuery as never)
      .mockReturnValueOnce(insertQuery as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        { date: '2026-01-01', name: 'Confraternização mundial', type: 'national' },
        { date: '2026-02-16', name: 'Carnaval', type: 'national' },
      ]),
    }));

    const result = await academicCalendarService.importBrazilianNationalHolidays({
      institutionId: 'institution-1',
      academicYearId: 'year-1',
      createdBy: 'profile-1',
      year: 2026,
    });

    expect(result).toEqual({ year: 2026, total: 2, imported: 1, skipped: 1 });
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: 'Carnaval',
        starts_at: '2026-02-16T00:00:00.000Z',
        all_day: true,
        event_type: 'HOLIDAY',
      }),
    ]);
  });

  it('lista todos os eventos ativos visíveis para o aluno', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await academicCalendarService.listForStudent('institution-1');

    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(query.eq).toHaveBeenCalledWith('active', true);
    expect(query.order).toHaveBeenCalledWith('starts_at', { ascending: true });
    expect(query.limit).not.toHaveBeenCalled();
  });

  it('carrega bloqueios de toda a janela em uma única consulta', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await academicCalendarService.listBlockingEventsForRange(
      'institution-1',
      '2026-09-01',
      '2026-09-30',
    );

    expect(supabase.from).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(query.eq).toHaveBeenCalledWith('active', true);
    expect(query.eq).toHaveBeenCalledWith('all_day', true);
    expect(query.in).toHaveBeenCalledWith(
      'event_type',
      ['HOLIDAY', 'RECESS', 'CLASS_SUSPENSION'],
    );
    expect(query.lt).toHaveBeenCalledWith(
      'starts_at',
      '2026-10-01T00:00:00.000Z',
    );
    expect(query.or).toHaveBeenCalledWith(
      'ends_at.gte.2026-09-01T00:00:00.000Z,ends_at.is.null',
    );
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

  it('obriga a publicar rematrícula pelo fluxo atômico do calendário', async () => {
    await expect(academicCalendarService.create({
      ...validInput,
      event_type: 'RE_ENROLLMENT',
    })).rejects.toThrow('Publique a rematrícula pelo assistente do calendário.');
    await expect(academicCalendarService.createMany([{
      ...validInput,
      event_type: 'RE_ENROLLMENT',
    }])).rejects.toThrow('Publique a rematrícula pelo assistente do calendário.');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('publica evento e campanha juntos, sem enviar hash manual do contrato', async () => {
    const campaign = {
      id: 'campaign-1',
      institution_id: 'institution-1',
      academic_calendar_event_id: 'event-1',
      ...reenrollmentSettings,
      title: 'Rematrícula 2027',
      description: 'Período de confirmação',
      status: 'OPEN',
      opens_at: '2026-09-15T11:00:00.000Z',
      closes_at: '2026-09-15T12:00:00.000Z',
      contract_hash: 'sha256:computed-by-database',
      require_academic_result: true,
      require_financial_clearance: true,
      allow_class_choice: false,
      finance_monthly_amount_cents: null,
      finance_enrollment_fee_cents: 0,
      finance_installment_count: null,
      finance_first_due_date: null,
      finance_due_day: null,
      finance_scholarship_per_installment_cents: 0,
      finance_discount_per_installment_cents: 0,
      finance_punctuality_discount_cents: 0,
      finance_fine_rate_bps: 0,
      finance_monthly_interest_rate_bps: 0,
      finance_grace_days: 0,
      finance_allow_manual_clearance: false,
      created_by: 'profile-1',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    };
    const event = {
      id: 'event-1',
      institution_id: 'institution-1',
      academic_year_id: 'year-2026',
      title: 'Rematrícula 2027',
      description: 'Período de confirmação',
      event_type: 'RE_ENROLLMENT',
      starts_at: '2026-09-15T11:00:00.000Z',
      ends_at: '2026-09-15T12:00:00.000Z',
      all_day: false,
      audience: 'ALL',
      class_id: null,
      subject_id: null,
      active: true,
      created_by: 'profile-1',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    };
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { event, campaign, replayed: false },
      error: null,
    } as never);

    const result = await academicCalendarService.publishReenrollment(
      null,
      {
        ...validInput,
        title: 'Rematrícula 2027',
        event_type: 'RE_ENROLLMENT',
        starts_at: '2026-09-15T08:00',
        ends_at: '2026-09-15T09:00',
      },
      reenrollmentSettings,
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      'publish_reenrollment_calendar_event_v21',
      expect.objectContaining({
        p_event_id: null,
        p_institution_id: 'institution-1',
        p_event: expect.objectContaining({
          event_type: 'RE_ENROLLMENT',
          audience: 'ALL',
          all_day: false,
        }),
        p_campaign: expect.objectContaining({
          source_academic_year_id: 'year-2026',
          destination_academic_year_id: 'year-2027',
          show_future_notice: true,
          contract_body: reenrollmentSettings.contract_body,
        }),
      }),
    );
    const rpcPayload = vi.mocked(supabase.rpc).mock.calls[0][1] as {
      p_campaign: Record<string, unknown>;
    };
    expect(rpcPayload.p_campaign).not.toHaveProperty('contract_hash');
    expect(result).toMatchObject({
      event: { id: 'event-1', event_type: 'RE_ENROLLMENT' },
      campaign: { id: 'campaign-1', contract_hash: 'sha256:computed-by-database' },
      replayed: false,
    });
  });

  it('valida a configuração da campanha antes de chamar a RPC', async () => {
    await expect(academicCalendarService.publishReenrollment(
      null,
      { ...validInput, event_type: 'RE_ENROLLMENT' },
      { ...reenrollmentSettings, destination_academic_year_id: 'year-2026' },
    )).rejects.toThrow('Os anos letivos de origem e destino precisam ser diferentes.');

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('altera o estado do calendário pelo RPC sincronizado', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);

    await academicCalendarService.setActive('event-1', 'institution-1', false);

    expect(supabase.rpc).toHaveBeenCalledWith('set_academic_calendar_event_active_v21', {
      p_event_id: 'event-1',
      p_institution_id: 'institution-1',
      p_active: false,
    });
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

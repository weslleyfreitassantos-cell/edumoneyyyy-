import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { selfRegistrationService } from './selfRegistrationService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('selfRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normaliza o cadastro completo do aluno', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        role: 'STUDENT',
        profile: {
          full_name: 'Ana Souza',
          email: 'ana@example.com',
          phone: '(71) 99999-0000',
        },
        student: {
          birth_date: '2010-03-12',
          cpf: '12345678900',
          social_name: null,
          rg: '1234567',
          rg_issuing_authority: 'SSP',
          rg_state: 'BA',
          birth_certificate: null,
          nationality: 'Brasileira',
          birthplace: 'Salvador',
          birth_state: 'BA',
          sex: 'F',
          address: { rural_zone: false },
          previous_schooling: { origin_year: 2025 },
          health: { autism: true },
        },
      },
      error: null,
    } as never);

    await expect(selfRegistrationService.getCurrent()).resolves.toEqual({
      role: 'STUDENT',
      profile: {
        fullName: 'Ana Souza',
        email: 'ana@example.com',
        phone: '(71) 99999-0000',
      },
      student: expect.objectContaining({
        birthDate: '2010-03-12',
        cpf: '12345678900',
        rg: '1234567',
        address: expect.objectContaining({
          ruralZone: false,
          street: '',
        }),
        previousSchooling: expect.objectContaining({
          originYear: '2025',
          historyDelivered: false,
        }),
        health: expect.objectContaining({
          autism: true,
          giftedness: false,
        }),
      }),
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_current_self_registration',
    );
  });

  it('mantém o responsável restrito ao próprio perfil', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        role: 'GUARDIAN',
        profile: {
          full_name: 'Carlos Souza',
          email: 'carlos@example.com',
          phone: null,
        },
      },
      error: null,
    } as never);

    await expect(selfRegistrationService.getCurrent()).resolves.toEqual({
      role: 'GUARDIAN',
      profile: {
        fullName: 'Carlos Souza',
        email: 'carlos@example.com',
        phone: '',
      },
    });
  });

  it('envia somente os campos editáveis do aluno', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        role: 'STUDENT',
        profile: { full_name: 'Ana Souza', email: 'ana@example.com', phone: '71999990000' },
        student: {},
      },
      error: null,
    } as never);

    const input = {
      role: 'STUDENT' as const,
      profile: { fullName: 'Ana Souza', phone: '71999990000' },
      student: {
        birthDate: '2010-03-12', cpf: '123', socialName: '', rg: '',
        rgIssuingAuthority: '', rgState: '', birthCertificate: '', nationality: '',
        birthplace: '', birthState: '', sex: '',
        address: {
          postalCode: '', street: '', number: '', complement: '', neighborhood: '',
          city: '', state: '', ruralZone: false,
        },
        previousSchooling: {
          originSchool: '', originNetwork: '', city: '', state: '', lastGrade: '',
          originYear: '', status: '', observations: '', historyDelivered: false,
          transferDeclaration: false,
        },
        health: {
          allergies: '', healthConditions: '', emergencyMedication: '', disability: '',
          autism: false, giftedness: false, needsSpecialEducation: false,
        },
      },
    };

    await selfRegistrationService.update(input);

    const payload = vi.mocked(supabase.rpc).mock.calls[0]?.[1] as {
      p_payload: Record<string, unknown>;
    };
    expect(payload.p_payload).toMatchObject({
      role: 'STUDENT',
      profile: { full_name: 'Ana Souza', phone: '71999990000' },
    });
    expect(payload.p_payload).not.toHaveProperty('student.academic_year_id');
    expect(payload.p_payload).not.toHaveProperty('student.class_id');
    expect(payload.p_payload).not.toHaveProperty('student.guardians');
  });
});

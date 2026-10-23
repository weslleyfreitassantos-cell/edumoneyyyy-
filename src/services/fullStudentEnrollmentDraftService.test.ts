import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: rpcMock },
}));

import { saveStudentEnrollmentDraft } from './fullStudentEnrollmentService';

describe('full student enrollment draft service', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: { draft_id: 'draft-1', version: 2 },
      error: null,
    });
  });

  it('sends health data only to the institution-scoped server RPC and strips files and storage paths', async () => {
    const draft = {
      identity: {
        full_name: 'Aluna de teste', email: '', birth_date: '2016-01-01', cpf: '',
        social_name: '', rg: '', rg_issuing_authority: '', rg_state: '',
        birth_certificate: '', nationality: 'Brasileira', birthplace: '', birth_state: '', sex: '', phone: '',
      },
      address: { postal_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', rural_zone: false },
      guardians: [],
      previous_schooling: { origin_school: '', origin_network: '', city: '', state: '', last_grade: '', origin_year: '', status: '', observations: '', history_delivered: false, transfer_declaration: false },
      health: { allergies: 'Informação médica sensível', health_conditions: '', emergency_medication: '', disability: '', autism: false, giftedness: false, needs_special_education: false, school_care_notes: '' },
      documents: [{
        document_type: 'Laudo ou relatorio', status: 'DELIVERED' as const, notes: '',
        file: { name: 'laudo.pdf' } as File,
        file_path: 'private/student/laudo.pdf',
      }],
      academic_year_id: 'year-1', class_id: 'class-1', enrolled_at: '2026-10-23',
    };

    await saveStudentEnrollmentDraft('institution-1', null, null, draft, 4);

    expect(rpcMock).toHaveBeenCalledWith('save_student_enrollment_draft', expect.objectContaining({
      p_institution_id: 'institution-1',
      p_draft_id: null,
      p_current_step: 4,
      p_payload: expect.objectContaining({
        health: expect.objectContaining({ allergies: 'Informação médica sensível' }),
      }),
    }));
    const sentPayload = JSON.stringify(rpcMock.mock.calls[0][1].p_payload);
    expect(sentPayload).not.toContain('laudo.pdf');
    expect(sentPayload).not.toContain('private/student');
    expect(sentPayload).not.toContain('file_path');
    expect(sentPayload).not.toContain('"file"');
  });
});

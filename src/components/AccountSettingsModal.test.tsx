// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AccountSettingsModal from './AccountSettingsModal';

vi.mock('../services/selfRegistrationService', () => ({
  selfRegistrationService: {
    getCurrent: vi.fn(),
  },
}));

import { selfRegistrationService } from '../services/selfRegistrationService';

const baseProps = {
  currentName: 'Ana Silva',
  email: 'ana@example.com',
  returnFocusRef: { current: null },
  onClose: vi.fn(),
  onUpdateName: vi.fn(async () => undefined),
  currentAvatar: 'https://example.com/avatar.webp',
  onUpdateAvatar: vi.fn(async () => undefined),
  onRemoveAvatar: vi.fn(async () => undefined),
  onUpdateSelfRegistration: vi.fn(async () => undefined),
  onUpdatePassword: vi.fn(async () => undefined),
  onSuccess: vi.fn(),
  currentRole: 'admin' as const,
};

const completeStudentRegistration = {
  role: 'STUDENT' as const,
  selfRegistrationConfirmed: false,
  profile: { fullName: 'Ana Souza', email: 'ana@example.com', phone: '71999990000' },
  student: {
    birthDate: '2010-03-12', cpf: '52998224725', socialName: '', rg: '',
    rgIssuingAuthority: '', rgState: '', birthCertificate: '', nationality: 'Brasileira',
    birthplace: 'Salvador', birthState: 'BA', sex: 'F',
    address: { postalCode: '40140110', street: 'Rua A', number: '10', complement: '', neighborhood: 'Centro', city: 'Salvador', state: 'BA', ruralZone: false },
    previousSchooling: { originSchool: '', originNetwork: '', city: '', state: '', lastGrade: '', originYear: '', status: '', observations: '', historyDelivered: false, transferDeclaration: false },
    health: { allergies: '', healthConditions: '', emergencyMedication: '', disability: '', autism: false, giftedness: false, needsSpecialEducation: false },
  },
};

function hasRequiredMarker(label: string): boolean {
  const field = screen.getByLabelText(label) as HTMLInputElement;
  return Boolean(field.labels?.[0]?.querySelector('.required-field-mark'));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:profile-preview'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AccountSettingsModal', () => {
  it.each(['admin', 'director', 'secretary', 'teacher', 'super_admin'] as const)(
    'marca Nome como obrigatório para %s sem marcar campos inexistentes',
    (role) => {
      render(<AccountSettingsModal {...baseProps} currentRole={role} />);

      expect(hasRequiredMarker('Nome')).toBe(true);
      expect(screen.queryByLabelText('Telefone')).toBeNull();
    },
  );

  it('marca os campos exigidos do aluno, mantém opcionais sem asterisco e usa aria-required', async () => {
    vi.mocked(selfRegistrationService.getCurrent).mockResolvedValue(completeStudentRegistration);

    render(<AccountSettingsModal {...baseProps} currentRole="student" />);
    await screen.findByLabelText('CPF');

    for (const label of [
      'Nome', 'Telefone', 'Data de nascimento', 'CPF', 'Sexo',
      'Nacionalidade', 'Naturalidade', 'UF de nascimento', 'CEP',
      'Logradouro', 'Número', 'Bairro', 'Cidade', 'UF',
    ]) {
      expect(hasRequiredMarker(label)).toBe(true);
    }
    expect((screen.getByLabelText('CPF') as HTMLInputElement).getAttribute('aria-required')).toBe('true');
    expect(hasRequiredMarker('Nome social')).toBe(false);
    expect(hasRequiredMarker('Complemento')).toBe(false);
    expect(hasRequiredMarker('RG')).toBe(false);
  });

  it('bloqueia o salvamento do aluno incompleto antes da confirmação', async () => {
    const onUpdateSelfRegistration = vi.fn(async () => undefined);
    vi.mocked(selfRegistrationService.getCurrent).mockResolvedValue({
      ...completeStudentRegistration,
      student: {
        ...completeStudentRegistration.student,
        address: { ...completeStudentRegistration.student.address, city: '' },
      },
    });

    render(<AccountSettingsModal {...baseProps} currentRole="student" onUpdateSelfRegistration={onUpdateSelfRegistration} />);
    await screen.findByLabelText('CPF');
    fireEvent.change(screen.getByLabelText('Nome social'), { target: { value: 'Ana Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Complete os dados cadastrais obrigatórios',
    );
    expect(onUpdateSelfRegistration).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('');
  });

  it('mantém Nome obrigatório e telefone opcional para responsável', async () => {
    vi.mocked(selfRegistrationService.getCurrent).mockResolvedValue({
      role: 'GUARDIAN',
      selfRegistrationConfirmed: false,
      profile: { fullName: 'Carlos Souza', email: 'carlos@example.com', phone: '' },
    });

    render(<AccountSettingsModal {...baseProps} currentRole="parent" />);
    await screen.findByLabelText('Telefone');

    expect(hasRequiredMarker('Nome')).toBe(true);
    expect(hasRequiredMarker('Telefone')).toBe(false);
  });

  it('aceita uma foto maior que 5 MB e exibe a imagem completa', async () => {
    render(<AccountSettingsModal {...baseProps} />);

    expect(screen.getByText('JPG, PNG ou WebP')).toBeTruthy();
    expect(screen.queryByText(/5 MB/i)).toBeNull();
    expect(screen.getByAltText('Foto de Ana Silva').className).toContain(
      'object-cover',
    );

    const file = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'foto-grande.png',
      { type: 'image/png' },
    );
    const input = screen.getByLabelText('Alterar foto');

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar foto' }));

    await waitFor(() => {
      expect(baseProps.onUpdateAvatar).toHaveBeenCalledWith(file);
    });
  });

  it('pede confirmação explícita antes de bloquear o cadastro do aluno', async () => {
    vi.mocked(selfRegistrationService.getCurrent).mockResolvedValue({
      role: 'STUDENT',
      selfRegistrationConfirmed: false,
      profile: { fullName: 'Ana Souza', email: 'ana@example.com', phone: '71999990000' },
      student: {
        birthDate: '2010-03-12', cpf: '52998224725', socialName: '', rg: '',
        rgIssuingAuthority: '', rgState: '', birthCertificate: '', nationality: 'Brasileira',
        birthplace: 'Salvador', birthState: 'BA', sex: 'F',
        address: { postalCode: '40140110', street: 'Rua A', number: '10', complement: '', neighborhood: 'Centro', city: 'Salvador', state: 'BA', ruralZone: false },
        previousSchooling: { originSchool: '', originNetwork: '', city: '', state: '', lastGrade: '', originYear: '', status: '', observations: '', historyDelivered: false, transferDeclaration: false },
        health: { allergies: '', healthConditions: '', emergencyMedication: '', disability: '', autism: false, giftedness: false, needsSpecialEducation: false },
      },
    });
    const onUpdateSelfRegistration = vi.fn(async () => undefined);

    render(<AccountSettingsModal {...baseProps} currentRole="student" onUpdateSelfRegistration={onUpdateSelfRegistration} currentName="Ana Souza" email="ana@example.com" />);
    await waitFor(() => expect(screen.getByDisplayValue('Ana Souza')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Nome social'), { target: { value: 'Ana Maria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar cadastro' }));

    expect(await screen.findByRole('heading', { name: 'Confirme seus dados' })).toBeTruthy();
    expect(onUpdateSelfRegistration).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar dados' }));
    await waitFor(() => expect(onUpdateSelfRegistration).toHaveBeenCalledWith(expect.objectContaining({ confirmProtectedData: true })));
  });

  it('mantém dados protegidos visíveis e bloqueados depois da confirmação, mas libera telefone', async () => {
    vi.mocked(selfRegistrationService.getCurrent).mockResolvedValue({
      role: 'STUDENT',
      selfRegistrationConfirmed: true,
      profile: { fullName: 'Ana Souza', email: 'ana@example.com', phone: '71999990000' },
      student: {
        birthDate: '2010-03-12', cpf: '52998224725', socialName: '', rg: '', rgIssuingAuthority: '', rgState: '', birthCertificate: '', nationality: 'Brasileira', birthplace: 'Salvador', birthState: 'BA', sex: 'F',
        address: { postalCode: '40140110', street: 'Rua A', number: '10', complement: '', neighborhood: 'Centro', city: 'Salvador', state: 'BA', ruralZone: false },
        previousSchooling: { originSchool: '', originNetwork: '', city: '', state: '', lastGrade: '', originYear: '', status: '', observations: '', historyDelivered: false, transferDeclaration: false },
        health: { allergies: '', healthConditions: '', emergencyMedication: '', disability: '', autism: false, giftedness: false, needsSpecialEducation: false },
      },
    });

    render(<AccountSettingsModal {...baseProps} currentRole="student" currentName="Ana Souza" email="ana@example.com" />);
    expect(await screen.findByText('Dados cadastrais confirmados.')).toBeTruthy();
    expect((screen.getByLabelText('CPF') as HTMLInputElement).disabled).toBe(true);
    expect(hasRequiredMarker('CPF')).toBe(false);
    expect((screen.getByLabelText('Nome') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Telefone') as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Confirmar dados' })).toBeNull();
  });
});

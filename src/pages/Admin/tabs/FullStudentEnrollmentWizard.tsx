import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';
import {
  useCreateFullStudentEnrollment,
  useStudentEditorData,
  useUpdateFullStudentEnrollment,
} from '../../../hooks/useFullStudentEnrollment';

import type { AcademicYearRow } from '../../../services/academicStructureService';
import type { ClassRow } from '../../../services/classService';
import {
  findDuplicateStudentCandidates,
  FullStudentEnrollmentError,
  type FullStudentEnrollmentDraft,
  type GuardianDraft,
  type StudentDocumentDraft,
} from '../../../services/fullStudentEnrollmentService';

interface FullStudentEnrollmentWizardProps {
  institutionId: string;
  years: AcademicYearRow[];
  classes: ClassRow[];
  mode?: 'create' | 'edit';
  studentId?: string;
  onClose: () => void;
  onCompleted: () => void;
  onUseExistingStudent?: (studentId: string) => void;
}

const steps = [
  'Aluno',
  'Endereco',
  'Responsaveis',
  'Dados escolares',
  'Saude',
  'Documentos',
  'Matricula',
  'Revisao',
];

const documentTypes = [
  'Certidao de nascimento',
  'RG',
  'CPF',
  'Comprovante de endereco',
  'Historico escolar',
  'Declaracao de transferencia',
  'Carteira de vacinacao',
  'Laudo ou relatorio',
  'Foto 3x4',
  'Outros',
];

function emptyDocuments(): StudentDocumentDraft[] {
  return documentTypes.map((documentType) => ({
    document_type: documentType,
    status: 'PENDING',
    notes: '',
  }));
}

function createEmptyGuardian(): GuardianDraft {
  return {
    mode: 'existing',
    profile_id: '',
    full_name: '',
    email: '',
    phone: '',
    relationship: '',
    is_primary: true,
  };
}

function createDraft(
  yearId = '',
  classId = '',
): FullStudentEnrollmentDraft {
  return {
    identity: {
      full_name: '',
      email: '',
      birth_date: '',
      cpf: '',
      social_name: '',
      rg: '',
      rg_issuing_authority: '',
      rg_state: '',
      birth_certificate: '',
      nationality: 'Brasileira',
      birthplace: '',
      birth_state: '',
      sex: '',
      phone: '',
    },
    address: {
      postal_code: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      rural_zone: false,
    },
    guardians: [createEmptyGuardian()],
    previous_schooling: {
      origin_school: '',
      origin_network: '',
      city: '',
      state: '',
      last_grade: '',
      origin_year: '',
      status: '',
      observations: '',
      history_delivered: false,
      transfer_declaration: false,
    },
    health: {
      allergies: '',
      health_conditions: '',
      emergency_medication: '',
      disability: '',
      autism: false,
      giftedness: false,
      needs_special_education: false,
      school_care_notes: '',
    },
    documents: emptyDocuments(),
    academic_year_id: yearId,
    class_id: classId,
    enrolled_at: new Date().toISOString().slice(0, 10),
  };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export default function FullStudentEnrollmentWizard({
  institutionId,
  years,
  classes,
  mode = 'create',
  studentId,
  onClose,
  onCompleted,
  onUseExistingStudent,
}: FullStudentEnrollmentWizardProps) {
  const isEditMode = mode === 'edit';
  const activeYears = useMemo(
    () => years.filter((year) => year.active),
    [years],
  );
  const activeClasses = useMemo(
    () => classes.filter((classRecord) => classRecord.active),
    [classes],
  );
  const firstYear = activeYears[0]?.id ?? years[0]?.id ?? '';
  const firstClass = activeClasses.find(
    (classRecord) => classRecord.academic_year_id === firstYear,
  );
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FullStudentEnrollmentDraft>(() =>
    createDraft(
      isEditMode ? '' : firstYear,
      isEditMode ? '' : firstClass?.id ?? '',
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Awaited<ReturnType<typeof findDuplicateStudentCandidates>>
  >([]);
  const [createdStudentId, setCreatedStudentId] = useState<string>();
  const [editEnrollmentId, setEditEnrollmentId] = useState<string | null>(null);
  const [loadedEditStudentId, setLoadedEditStudentId] = useState<string | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const createMutation = useCreateFullStudentEnrollment();
  const updateMutation = useUpdateFullStudentEnrollment();
  const editorQuery = useStudentEditorData(
    institutionId,
    isEditMode ? studentId ?? null : null,
  );
  const usersQuery = useSchoolUsers(institutionId, true);

  const guardians = useMemo(
    () =>
      (usersQuery.data ?? []).filter(
        (user) =>
          user.role === 'GUARDIAN' &&
          user.active &&
          user.profile?.active !== false,
      ),
    [usersQuery.data],
  );

  useEffect(() => {
    if (!isEditMode && !draft.academic_year_id && firstYear) {
      setDraft((current) => ({
        ...current,
        academic_year_id: firstYear,
        class_id: firstClass?.id ?? '',
      }));
    }
  }, [draft.academic_year_id, firstClass?.id, firstYear, isEditMode]);

  useEffect(() => {
    if (
      !isEditMode ||
      !studentId ||
      !editorQuery.data ||
      loadedEditStudentId === studentId
    ) {
      return;
    }

    setDraft(editorQuery.data.draft);
    setEditEnrollmentId(editorQuery.data.enrollmentId);
    setLoadedEditStudentId(studentId);
    setError(null);
  }, [
    editorQuery.data,
    isEditMode,
    loadedEditStudentId,
    studentId,
  ]);

  function updateIdentity(
    field: keyof FullStudentEnrollmentDraft['identity'],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      identity: { ...current.identity, [field]: value },
    }));
  }

  function updateAddress(
    field: keyof FullStudentEnrollmentDraft['address'],
    value: string | boolean,
  ) {
    setDraft((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));
  }

  function updateGuardian(
    index: number,
    patch: Partial<GuardianDraft>,
  ) {
    setDraft((current) => ({
      ...current,
      guardians: current.guardians.map((guardian, guardianIndex) =>
        guardianIndex === index ? { ...guardian, ...patch } : guardian,
      ),
    }));
  }

  function addGuardian() {
    setDraft((current) => ({
      ...current,
      guardians: [
        ...current.guardians,
        { ...createEmptyGuardian(), is_primary: false },
      ],
    }));
  }

  function removeGuardian(index: number) {
    setDraft((current) => ({
      ...current,
      guardians: current.guardians.filter((_, guardianIndex) => guardianIndex !== index),
    }));
  }

  function setPrimaryGuardian(index: number) {
    setDraft((current) => ({
      ...current,
      guardians: current.guardians.map((guardian, guardianIndex) => ({
        ...guardian,
        is_primary: guardianIndex === index,
      })),
    }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (draft.identity.full_name.trim().length < 3) return 'Informe o nome completo do aluno.';
      if (!/^\S+@\S+\.\S+$/.test(draft.identity.email.trim())) return 'Informe um e-mail valido para o aluno.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.identity.birth_date)) return 'Informe a data de nascimento do aluno.';
    }
    if (step === 2) {
      if (!isEditMode && draft.guardians.length === 0) return 'Associe pelo menos um responsavel.';
      for (const guardian of draft.guardians) {
        if (guardian.mode === 'existing' && !guardian.profile_id) return 'Selecione o responsavel existente ou escolha Novo responsavel.';
        if (guardian.mode === 'new' && guardian.full_name.trim().length < 3) return 'Informe o nome do novo responsavel.';
        if (guardian.mode === 'new' && !/^\S+@\S+\.\S+$/.test(guardian.email.trim())) return 'Informe um e-mail valido para o novo responsavel.';
        if (guardian.relationship.trim().length < 2) return 'Informe o parentesco de cada responsavel.';
      }
      if (draft.guardians.length > 0 && !draft.guardians.some((guardian) => guardian.is_primary)) return 'Marque um responsavel principal.';
    }
    if (step === 6) {
      if (!isEditMode || editEnrollmentId) {
        if (!draft.academic_year_id) return 'Selecione o ano letivo.';
        if (!draft.class_id) return 'Selecione a turma.';
      }
    }
    return null;
  }

  async function next() {
    setError(null);
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (step === 0 && !isEditMode) {
      setIsCheckingDuplicates(true);
      try {
        const candidates = await findDuplicateStudentCandidates(
          institutionId,
          draft.identity,
        );
        if (candidates.length > 0) {
          setDuplicates(candidates);
          setError('Encontramos possiveis cadastros existentes. Revise antes de continuar.');
          return;
        }
      } catch (duplicateError) {
        setError(duplicateError instanceof Error ? duplicateError.message : 'Nao foi possivel verificar duplicidade.');
        return;
      } finally {
        setIsCheckingDuplicates(false);
      }
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function continueAfterDuplicateCheck() {
    if (!window.confirm('O cadastro pode ser do mesmo aluno. Deseja continuar criando um novo cadastro?')) {
      return;
    }
    setDuplicates([]);
    setError(null);
    setStep(1);
  }

  async function submit() {
    setError(null);
    const result = validateStep();
    if (result) {
      setError(result);
      setStep(6);
      return;
    }

    if (isEditMode) {
      if (!studentId || !editorQuery.data) {
        setError('Os dados do aluno ainda nao foram carregados.');
        return;
      }

      try {
        await updateMutation.mutateAsync({
          institutionId,
          studentId,
          enrollmentId: editEnrollmentId,
          draft,
        });
        onCompleted();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel atualizar o cadastro completo do aluno.');
      }
      return;
    }

    try {
      await createMutation.mutateAsync({
        institutionId,
        draft,
        existingStudentId: createdStudentId,
      });
      onCompleted();
    } catch (submitError) {
      if (submitError instanceof FullStudentEnrollmentError) {
        if (submitError.studentId) setCreatedStudentId(submitError.studentId);
        setDraft((current) => ({
          ...current,
          guardians: current.guardians.map((guardian, index) => ({
            ...guardian,
            profile_id: guardian.profile_id || submitError.guardianProfileIds[index] || '',
          })),
        }));
        setError('Parte do cadastro foi criada, mas a matricula nao foi concluida. Corrija o problema e tente novamente; o sistema vai reutilizar os registros ja criados.');
      } else {
        setError(submitError instanceof Error ? submitError.message : 'Nao foi possivel concluir a matricula.');
      }
    }
  }

  function renderIdentity() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome completo *"><input className={inputClass} value={draft.identity.full_name} onChange={(event) => updateIdentity('full_name', event.target.value)} /></Field>
        <Field label="E-mail *"><input type="email" className={inputClass} value={draft.identity.email} onChange={(event) => updateIdentity('email', event.target.value)} /></Field>
        <Field label="Data de nascimento *"><input type="date" className={inputClass} value={draft.identity.birth_date} onChange={(event) => updateIdentity('birth_date', event.target.value)} /></Field>
        <Field label="CPF"><input className={inputClass} value={draft.identity.cpf} onChange={(event) => updateIdentity('cpf', event.target.value)} /></Field>
        <Field label="Nome social"><input className={inputClass} value={draft.identity.social_name} onChange={(event) => updateIdentity('social_name', event.target.value)} /></Field>
        <Field label="Telefone"><input className={inputClass} value={draft.identity.phone} onChange={(event) => updateIdentity('phone', event.target.value)} /></Field>
        <Field label="RG"><input className={inputClass} value={draft.identity.rg} onChange={(event) => updateIdentity('rg', event.target.value)} /></Field>
        <Field label="Orgao expedidor"><input className={inputClass} value={draft.identity.rg_issuing_authority} onChange={(event) => updateIdentity('rg_issuing_authority', event.target.value)} /></Field>
        <Field label="UF do RG"><input maxLength={2} className={inputClass} value={draft.identity.rg_state} onChange={(event) => updateIdentity('rg_state', event.target.value.toUpperCase())} /></Field>
        <Field label="Certidao de nascimento"><input className={inputClass} value={draft.identity.birth_certificate} onChange={(event) => updateIdentity('birth_certificate', event.target.value)} /></Field>
        <Field label="Nacionalidade"><input className={inputClass} value={draft.identity.nationality} onChange={(event) => updateIdentity('nationality', event.target.value)} /></Field>
        <Field label="Naturalidade"><input className={inputClass} value={draft.identity.birthplace} onChange={(event) => updateIdentity('birthplace', event.target.value)} /></Field>
        <Field label="UF de nascimento"><input maxLength={2} className={inputClass} value={draft.identity.birth_state} onChange={(event) => updateIdentity('birth_state', event.target.value.toUpperCase())} /></Field>
        <Field label="Sexo"><select className={inputClass} value={draft.identity.sex} onChange={(event) => updateIdentity('sex', event.target.value)}><option value="">Nao informado</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option></select></Field>
      </div>
    );
  }

  function renderAddress() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="CEP"><input className={inputClass} value={draft.address.postal_code} onChange={(event) => updateAddress('postal_code', event.target.value)} /></Field>
        <Field label="Logradouro"><input className={inputClass} value={draft.address.street} onChange={(event) => updateAddress('street', event.target.value)} /></Field>
        <Field label="Numero"><input className={inputClass} value={draft.address.number} onChange={(event) => updateAddress('number', event.target.value)} /></Field>
        <Field label="Complemento"><input className={inputClass} value={draft.address.complement} onChange={(event) => updateAddress('complement', event.target.value)} /></Field>
        <Field label="Bairro"><input className={inputClass} value={draft.address.neighborhood} onChange={(event) => updateAddress('neighborhood', event.target.value)} /></Field>
        <Field label="Cidade"><input className={inputClass} value={draft.address.city} onChange={(event) => updateAddress('city', event.target.value)} /></Field>
        <Field label="UF"><input maxLength={2} className={inputClass} value={draft.address.state} onChange={(event) => updateAddress('state', event.target.value.toUpperCase())} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={draft.address.rural_zone} onChange={(event) => updateAddress('rural_zone', event.target.checked)} /> Zona rural</label>
      </div>
    );
  }

  function renderGuardians() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Associe um ou mais responsaveis. O principal sera usado como contato prioritario.</p>
        {draft.guardians.map((guardian, index) => {
          const matchingGuardian = guardian.mode === 'new'
            ? guardians.find((user) => user.profile?.email?.trim().toLowerCase() === guardian.email.trim().toLowerCase())
            : undefined;

          return (
            <div key={`${index}-${guardian.profile_id}`} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm text-slate-800">Responsavel {index + 1}</strong>{draft.guardians.length > 1 ? <button type="button" className="text-sm text-red-600" onClick={() => removeGuardian(index)}>Remover</button> : null}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Origem"><select className={inputClass} value={guardian.mode} onChange={(event) => updateGuardian(index, { mode: event.target.value as GuardianDraft['mode'], profile_id: '' })}><option value="existing">Responsavel ja cadastrado</option><option value="new">Novo responsavel</option></select></Field>
                {guardian.mode === 'existing' ? <Field label="Responsavel"><select className={inputClass} value={guardian.profile_id} onChange={(event) => updateGuardian(index, { profile_id: event.target.value })}><option value="">Selecione</option>{guardians.map((user) => <option key={user.profile_id} value={user.profile_id}>{user.profile?.full_name ?? user.profile?.email}</option>)}</select></Field> : <><Field label="Nome completo *"><input className={inputClass} value={guardian.full_name} onChange={(event) => updateGuardian(index, { full_name: event.target.value })} /></Field><Field label="E-mail *"><input type="email" className={inputClass} value={guardian.email} onChange={(event) => updateGuardian(index, { email: event.target.value })} /></Field><Field label="Telefone"><input className={inputClass} value={guardian.phone} onChange={(event) => updateGuardian(index, { phone: event.target.value })} /></Field></>}
                <Field label="Parentesco *"><input className={inputClass} value={guardian.relationship} onChange={(event) => updateGuardian(index, { relationship: event.target.value })} placeholder="Mae, pai, avo..." /></Field>
              </div>
              {matchingGuardian ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>Ja existe um responsavel com este e-mail: <strong>{matchingGuardian.profile?.full_name ?? matchingGuardian.profile?.email}</strong>.</p><button type="button" className="mt-2 rounded-lg border border-amber-700 px-3 py-2 font-semibold" onClick={() => updateGuardian(index, { mode: 'existing', profile_id: matchingGuardian.profile_id })}>Usar cadastro existente</button></div> : null}
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700"><input type="radio" name="primary-guardian" checked={guardian.is_primary} onChange={() => setPrimaryGuardian(index)} /> Responsavel principal</label>
            </div>
          );
        })}
        <button type="button" className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700" onClick={addGuardian}>+ Adicionar responsavel</button>
      </div>
    );
  }

  function renderPreviousSchooling() {
    const previous = draft.previous_schooling;
    const update = (field: keyof typeof previous, value: string | boolean) => setDraft((current) => ({ ...current, previous_schooling: { ...current.previous_schooling, [field]: value } }));
    return <div className="grid gap-4 md:grid-cols-2"><Field label="Escola de origem"><input className={inputClass} value={previous.origin_school} onChange={(event) => update('origin_school', event.target.value)} /></Field><Field label="Rede de ensino"><input className={inputClass} value={previous.origin_network} onChange={(event) => update('origin_network', event.target.value)} /></Field><Field label="Cidade"><input className={inputClass} value={previous.city} onChange={(event) => update('city', event.target.value)} /></Field><Field label="UF"><input maxLength={2} className={inputClass} value={previous.state} onChange={(event) => update('state', event.target.value.toUpperCase())} /></Field><Field label="Ultima serie"><input className={inputClass} value={previous.last_grade} onChange={(event) => update('last_grade', event.target.value)} /></Field><Field label="Ano de origem"><input type="number" className={inputClass} value={previous.origin_year} onChange={(event) => update('origin_year', event.target.value)} /></Field><Field label="Situacao"><input className={inputClass} value={previous.status} onChange={(event) => update('status', event.target.value)} /></Field><Field label="Observacoes"><textarea className={inputClass} value={previous.observations} onChange={(event) => update('observations', event.target.value)} /></Field><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={previous.history_delivered} onChange={(event) => update('history_delivered', event.target.checked)} /> Historico entregue</label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={previous.transfer_declaration} onChange={(event) => update('transfer_declaration', event.target.checked)} /> Declaracao de transferencia entregue</label></div>;
  }

  function renderHealth() {
    const health = draft.health;
    const update = (field: keyof typeof health, value: string | boolean) => setDraft((current) => ({ ...current, health: { ...current.health, [field]: value } }));
    return <div className="space-y-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Dados de saude sao sensiveis e ficam restritos a ADMIN, DIRECTOR e SECRETARY.</div><div className="grid gap-4 md:grid-cols-2"><Field label="Alergias"><textarea className={inputClass} value={health.allergies} onChange={(event) => update('allergies', event.target.value)} /></Field><Field label="Condicoes de saude"><textarea className={inputClass} value={health.health_conditions} onChange={(event) => update('health_conditions', event.target.value)} /></Field><Field label="Medicacao de emergencia"><textarea className={inputClass} value={health.emergency_medication} onChange={(event) => update('emergency_medication', event.target.value)} /></Field><Field label="Deficiencia ou necessidade"><textarea className={inputClass} value={health.disability} onChange={(event) => update('disability', event.target.value)} /></Field><Field label="Cuidados na escola"><textarea className={inputClass} value={health.school_care_notes} onChange={(event) => update('school_care_notes', event.target.value)} /></Field></div><div className="flex flex-wrap gap-4 text-sm text-slate-700"><label className="flex items-center gap-2"><input type="checkbox" checked={health.autism} onChange={(event) => update('autism', event.target.checked)} /> TEA</label><label className="flex items-center gap-2"><input type="checkbox" checked={health.giftedness} onChange={(event) => update('giftedness', event.target.checked)} /> Altas habilidades</label><label className="flex items-center gap-2"><input type="checkbox" checked={health.needs_special_education} onChange={(event) => update('needs_special_education', event.target.checked)} /> Atendimento educacional especializado</label></div></div>;
  }

  function renderDocuments() {
    return <div className="space-y-3"><p className="text-sm text-slate-600">Esta etapa registra a pendencia documental. Upload de arquivos sera ativado somente com storage privado e politica validada.</p>{draft.documents.map((document, index) => <div key={document.document_type} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_180px_1fr]"><span className="self-center text-sm font-medium text-slate-700">{document.document_type}</span><select className={inputClass} value={document.status} onChange={(event) => setDraft((current) => ({ ...current, documents: current.documents.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value as StudentDocumentDraft['status'] } : item) }))}><option value="PENDING">Pendente</option><option value="DELIVERED">Entregue</option><option value="VALIDATED">Validado</option><option value="DISPENSED">Dispensado</option></select><input className={inputClass} placeholder="Observacao" value={document.notes} onChange={(event) => setDraft((current) => ({ ...current, documents: current.documents.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item) }))} /></div>)}</div>;
  }

  function renderEnrollment() {
    const availableClasses = activeClasses.filter((classRecord) => classRecord.academic_year_id === draft.academic_year_id);
    return <div className="grid gap-4 md:grid-cols-2"><Field label="Ano letivo *"><select className={inputClass} value={draft.academic_year_id} onChange={(event) => setDraft((current) => ({ ...current, academic_year_id: event.target.value, class_id: activeClasses.find((classRecord) => classRecord.academic_year_id === event.target.value)?.id ?? '' }))}><option value="">Selecione</option>{years.filter((year) => year.active).map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></Field><Field label="Turma *"><select className={inputClass} value={draft.class_id} onChange={(event) => setDraft((current) => ({ ...current, class_id: event.target.value }))}><option value="">Selecione</option>{availableClasses.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classRecord.name} ({classRecord.active_enrollments_count}/{classRecord.capacity || 'sem limite'})</option>)}</select></Field><Field label="Data da matricula"><input type="date" className={inputClass} value={draft.enrolled_at} onChange={(event) => setDraft((current) => ({ ...current, enrolled_at: event.target.value }))} /></Field><div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Status inicial: <strong>Ativa</strong>. Transferencia, cancelamento e conclusao continuam disponiveis no fluxo de matriculas.</div></div>;
  }

  function renderReview() {
    const primary = draft.guardians.find((guardian) => guardian.is_primary);
    const year = years.find((item) => item.id === draft.academic_year_id);
    const classRecord = classes.find((item) => item.id === draft.class_id);
    return <div className="space-y-4 text-sm text-slate-700"><div className="grid gap-3 md:grid-cols-2"><div><strong>Aluno</strong><p>{draft.identity.full_name}</p><p>{draft.identity.email}</p><p>{draft.identity.birth_date}</p></div><div><strong>Matricula</strong><p>{year?.name ?? 'Ano nao selecionado'}</p><p>{classRecord?.name ?? 'Turma nao selecionada'}</p><p>{draft.enrolled_at}</p></div><div><strong>Responsavel principal</strong><p>{primary?.full_name || (primary?.profile_id ? 'Responsavel cadastrado' : 'Nao informado')}</p><p>{primary?.relationship}</p></div><div><strong>Documentos pendentes</strong><p>{draft.documents.filter((document) => document.status === 'PENDING').length}</p></div></div><div className="rounded-lg border border-blue-100 bg-blue-50 p-3">Ao confirmar, o aluno, os responsaveis, os dados complementares e a matricula serao persistidos. O acesso por e-mail sera criado conforme o fluxo de autenticacao.</div></div>;
  }

  function renderStep() {
    if (step === 0) return renderIdentity();
    if (step === 1) return renderAddress();
    if (step === 2) return renderGuardians();
    if (step === 3) return renderPreviousSchooling();
    if (step === 4) return renderHealth();
    if (step === 5) return renderDocuments();
    if (step === 6) return renderEnrollment();
    return renderReview();
  }

  if (isEditMode && editorQuery.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Editar aluno">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <p className="text-sm font-semibold text-slate-800">Carregando dados completos do aluno...</p>
        </div>
      </div>
    );
  }

  if (isEditMode && editorQuery.isError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Editar aluno">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <ErrorBox message={editorQuery.error instanceof Error ? editorQuery.error.message : 'Nao foi possivel carregar os dados do aluno.'} />
          <div className="mt-4 flex justify-end"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={onClose}>Fechar</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label={isEditMode ? 'Editar aluno' : 'Matricula completa de aluno'}>
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{isEditMode ? 'Editar aluno' : 'Novo aluno'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{isEditMode ? 'Editar cadastro completo' : 'Matricula completa'}</h2><p className="mt-1 text-sm text-slate-600">{isEditMode ? 'Atualize todos os dados cadastrais, escolares e da matricula.' : 'Cadastro detalhado com vinculos, documentos e revisao antes de confirmar.'}</p></div><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700" onClick={onClose} aria-label="Fechar">X</button></div>
        <div className="overflow-y-auto px-5 py-4"><div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-8">{steps.map((label, index) => <div key={label} className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${index === step ? 'bg-blue-700 text-white' : index < step ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><span className="block">{index + 1}</span>{label}</div>)}</div><div className="mb-4"><ErrorBox message={error} />{duplicates.length > 0 ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Possiveis duplicidades</strong>{duplicates.map((candidate) => <div key={candidate.id} className="mt-2 rounded-lg border border-amber-300 bg-white/70 p-3"><p className="font-semibold">{candidate.full_name}</p><p className="mt-1">Matricula {candidate.registration_number} - {candidate.birth_date}</p>{onUseExistingStudent ? <button type="button" className="mt-2 rounded-lg border border-blue-600 px-3 py-2 font-semibold text-blue-700" onClick={() => onUseExistingStudent(candidate.id)}>Usar este cadastro</button> : null}</div>)}<div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-400 bg-white px-3 py-2 font-semibold" onClick={() => setDuplicates([])}>Voltar e revisar</button><button type="button" className="rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white" onClick={continueAfterDuplicateCheck}>Continuar mesmo assim</button></div></div> : null}</div><div className="min-h-[300px]">{renderStep()}</div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={step === 0 ? onClose : () => { setError(null); setStep((current) => current - 1); }}>{step === 0 ? 'Cancelar' : 'Voltar'}</button><div className="flex gap-2"><span className="self-center text-xs text-slate-500">Etapa {step + 1} de {steps.length}</span>{step < steps.length - 1 ? <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={next} disabled={isCheckingDuplicates}>{isCheckingDuplicates ? 'Verificando...' : 'Continuar'}</button> : <button type="button" className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Salvando...' : isEditMode ? 'Salvar alteracoes' : 'Confirmar matricula'}</button>}</div></div>
      </div>
    </div>
  );
}

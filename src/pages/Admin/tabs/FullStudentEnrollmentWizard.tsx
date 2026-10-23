import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';
import {
  useCreateFullStudentEnrollment,
  useDiscardStudentEnrollmentDraft,
  useSaveStudentEnrollmentDraft,
  useStudentEnrollmentDrafts,
  useStudentEditorData,
  useUpdateFullStudentEnrollment,
} from '../../../hooks/useFullStudentEnrollment';

import type { AcademicYearRow } from '../../../services/academicStructureService';
import type { ClassRow } from '../../../services/classService';
import {
  getActiveClassesForYear,
  getPreferredAcademicYear,
  getSuggestedClassId,
  isClassAtCapacity,
  sortAcademicYearsForSelection,
} from '../../../lib/academicSelection';
import {
  findDuplicateStudentCandidates,
  FullStudentEnrollmentError,
  getStudentEnrollmentDraft,
  type FullStudentEnrollmentDraft,
  type GuardianDraft,
  type StudentEnrollmentDraftSaveResult,
  type StudentDocumentDraft,
} from '../../../services/fullStudentEnrollmentService';
import {
  createStudentDocumentSignedUrl,
  STUDENT_DOCUMENT_ACCEPT,
} from '../../../services/studentDocumentService';
import { registerStudentForInclusiveEducation } from '../../../services/inclusiveEducationService';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';

interface FullStudentEnrollmentWizardProps {
  institutionId: string;
  years: AcademicYearRow[];
  classes: ClassRow[];
  mode?: 'create' | 'edit' | 'enroll';
  studentId?: string;
  onClose: () => void;
  onCompleted: () => void;
  onUseExistingStudent?: (studentId: string) => void;
}

const steps = [
  'Aluno',
  'Endereço',
  'Responsáveis',
  'Dados escolares',
  'Saúde',
  'Documentos',
  'Matrícula',
  'Revisão',
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

const guardianRelationshipOptions = [
  'Mãe',
  'Pai',
  'Responsável legal',
  'Avó',
  'Avô',
  'Irmã',
  'Irmão',
  'Tia',
  'Tio',
  'Madrinha',
  'Padrinho',
  'Tutora',
  'Tutor',
  'Outro responsável',
];

function emptyDocuments(): StudentDocumentDraft[] {
  return documentTypes.map((documentType) => ({
    document_type: documentType,
    status: 'NOT_REQUESTED',
    notes: '',
  }));
}

const documentStatusLabels: Record<StudentDocumentDraft['status'], string> = {
  NOT_REQUESTED: 'Não solicitado',
  PENDING: 'Pendente',
  REQUESTED: 'Solicitado',
  DELIVERED: 'Recebido',
  UNDER_REVIEW: 'Em conferência',
  VALIDATED: 'Validado',
  REJECTED: 'Rejeitado',
  DISPENSED: 'Dispensado',
};

function documentNeedsFollowUp(status: StudentDocumentDraft['status']): boolean {
  return !['NOT_REQUESTED', 'VALIDATED', 'DISPENSED'].includes(status);
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

function hasMeaningfulEnrollmentDraft(draft: FullStudentEnrollmentDraft): boolean {
  const hasText = (value: string) => Boolean(value.trim());
  return Boolean(
    hasText(draft.identity.full_name) || hasText(draft.identity.email) ||
    hasText(draft.identity.birth_date) || hasText(draft.identity.cpf) ||
    hasText(draft.address.street) || hasText(draft.address.city) ||
    draft.guardians.some((guardian) => guardian.profile_id || hasText(guardian.full_name) || hasText(guardian.email)) ||
    hasText(draft.previous_schooling.origin_school) ||
    hasText(draft.health.allergies) || hasText(draft.health.health_conditions) ||
    hasText(draft.health.emergency_medication) || hasText(draft.health.disability) ||
    hasText(draft.health.school_care_notes) || draft.health.autism ||
    draft.health.giftedness || draft.health.needs_special_education ||
    draft.documents.some((document) => document.status !== 'NOT_REQUESTED' || hasText(document.notes))
  );
}

function enrollmentDraftFingerprint(
  draft: FullStudentEnrollmentDraft,
  currentStep: number,
): string {
  const safeDraft = {
    ...draft,
    documents: draft.documents.map(({ document_type, status, notes }) => ({
      document_type,
      status,
      notes,
    })),
  };
  return JSON.stringify({ draft: safeDraft, currentStep });
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
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300">
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
  const isExistingStudentMode = mode === 'edit' || mode === 'enroll';
  const activeYears = useMemo(
    () => sortAcademicYearsForSelection(years).filter((year) => year.active),
    [years],
  );
  const activeClasses = useMemo(
    () => classes.filter((classRecord) => classRecord.active),
    [classes],
  );
  const preferredYear = getPreferredAcademicYear(years);
  const firstYear = preferredYear?.id ?? '';
  const firstClassId = getSuggestedClassId(
    getActiveClassesForYear(activeClasses, firstYear),
  );
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<FullStudentEnrollmentDraft>(() =>
    createDraft(
      isExistingStudentMode ? '' : firstYear,
      isExistingStudentMode ? '' : firstClassId,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Awaited<ReturnType<typeof findDuplicateStudentCandidates>>
  >([]);
  const [createdStudentId, setCreatedStudentId] = useState<string>();
  const [editEnrollmentId, setEditEnrollmentId] = useState<string | null>(null);
  const [loadedEditStudentId, setLoadedEditStudentId] = useState<string | null>(null);
  const [registerInInclusiveEducation, setRegisterInInclusiveEducation] = useState(false);
  const [inclusiveEducationRegistered, setInclusiveEducationRegistered] = useState(false);
  const [isRegisteringInclusiveEducation, setIsRegisteringInclusiveEducation] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<'OPEN' | 'FINALIZING'>('OPEN');
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoadingSavedDraft, setIsLoadingSavedDraft] = useState(false);
  const [isDiscardingDraft, setIsDiscardingDraft] = useState(false);
  const persistentDraftRef = useRef<{
    id: string | null;
    version: number | null;
    status: 'OPEN' | 'FINALIZING';
  }>({ id: null, version: null, status: 'OPEN' });
  const lastPersistedFingerprintRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<StudentEnrollmentDraftSaveResult> | null>(null);
  const duplicateApprovalFingerprintRef = useRef<string | null>(null);
  const duplicateApprovalCandidateIdsRef = useRef<string[]>([]);
  const createMutation = useCreateFullStudentEnrollment();
  const updateMutation = useUpdateFullStudentEnrollment();
  const draftsQuery = useStudentEnrollmentDrafts(institutionId);
  const saveDraftMutation = useSaveStudentEnrollmentDraft();
  const discardDraftMutation = useDiscardStudentEnrollmentDraft();
  const editorQuery = useStudentEditorData(
    institutionId,
    isExistingStudentMode ? studentId ?? null : null,
  );
  const usersQuery = useSchoolUsers(institutionId, true);
  const saveDraft = saveDraftMutation.mutateAsync;

  const persistEnrollmentDraft = useCallback(async (
    snapshot: FullStudentEnrollmentDraft,
    snapshotStep: number,
  ): Promise<StudentEnrollmentDraftSaveResult | null> => {
    if (mode !== 'create' || !hasMeaningfulEnrollmentDraft(snapshot)) return null;
    if (persistentDraftRef.current.status === 'FINALIZING') {
      if (!persistentDraftRef.current.id || !persistentDraftRef.current.version) {
        throw new Error('ENROLLMENT_DRAFT_VERSION_CONFLICT');
      }
      return {
        draft_id: persistentDraftRef.current.id,
        version: persistentDraftRef.current.version,
      };
    }

    const fingerprint = enrollmentDraftFingerprint(snapshot, snapshotStep);
    if (
      persistentDraftRef.current.id &&
      lastPersistedFingerprintRef.current === fingerprint &&
      persistentDraftRef.current.version
    ) {
      return {
        draft_id: persistentDraftRef.current.id,
        version: persistentDraftRef.current.version,
      };
    }

    if (savePromiseRef.current) {
      await savePromiseRef.current;
      if (
        persistentDraftRef.current.id &&
        lastPersistedFingerprintRef.current === fingerprint &&
        persistentDraftRef.current.version
      ) {
        return {
          draft_id: persistentDraftRef.current.id,
          version: persistentDraftRef.current.version,
        };
      }
    }

    setDraftSaveState('saving');
    const request = saveDraft({
      institutionId,
      draftId: persistentDraftRef.current.id,
      expectedVersion: persistentDraftRef.current.version,
      draft: snapshot,
      currentStep: snapshotStep,
    });
    savePromiseRef.current = request;
    try {
      const saved = await request;
      persistentDraftRef.current = {
        id: saved.draft_id,
        version: saved.version,
        status: 'OPEN',
      };
      lastPersistedFingerprintRef.current = fingerprint;
      setDraftId(saved.draft_id);
      setDraftVersion(saved.version);
      setDraftStatus('OPEN');
      setDraftSaveState('saved');
      return saved;
    } catch (saveError) {
      setDraftSaveState('error');
      throw saveError;
    } finally {
      if (savePromiseRef.current === request) savePromiseRef.current = null;
    }
  }, [institutionId, mode, saveDraft]);

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
    if (
      mode !== 'create' || draftStatus === 'FINALIZING' ||
      !hasMeaningfulEnrollmentDraft(draft)
    ) return;
    const fingerprint = enrollmentDraftFingerprint(draft, step);
    if (fingerprint === lastPersistedFingerprintRef.current) return;
    const timer = window.setTimeout(() => {
      void persistEnrollmentDraft(draft, step).catch(() => {
        setDraftSaveState('error');
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [draft, draftStatus, mode, persistEnrollmentDraft, step]);

  useEffect(() => {
    if (!isExistingStudentMode && !draft.academic_year_id && firstYear) {
      setDraft((current) => ({
        ...current,
        academic_year_id: firstYear,
        class_id: firstClassId,
      }));
    }
  }, [draft.academic_year_id, firstClassId, firstYear, isExistingStudentMode]);

  useEffect(() => {
    if (
      !isExistingStudentMode ||
      !studentId ||
      !editorQuery.data ||
      loadedEditStudentId === studentId
    ) {
      return;
    }

    setDraft(editorQuery.data.draft);
    setRegisterInInclusiveEducation(false);
    setInclusiveEducationRegistered(false);
    setIsRegisteringInclusiveEducation(false);
    setEditEnrollmentId(editorQuery.data.enrollmentId);
    setLoadedEditStudentId(studentId);
    setError(null);
  }, [
    editorQuery.data,
    isExistingStudentMode,
    loadedEditStudentId,
    studentId,
  ]);

  async function resumeSavedDraft(targetDraftId: string) {
    setError(null);
    setIsLoadingSavedDraft(true);
    try {
      if (
        hasMeaningfulEnrollmentDraft(draft) &&
        persistentDraftRef.current.id !== targetDraftId
      ) {
        await persistEnrollmentDraft(draft, step);
      }
      const savedDraft = await getStudentEnrollmentDraft(institutionId, targetDraftId);
      const restoredFingerprint = enrollmentDraftFingerprint(
        savedDraft.payload,
        savedDraft.current_step,
      );
      persistentDraftRef.current = {
        id: savedDraft.draft_id,
        version: savedDraft.version,
        status: savedDraft.status,
      };
      lastPersistedFingerprintRef.current = restoredFingerprint;
      duplicateApprovalFingerprintRef.current = null;
      duplicateApprovalCandidateIdsRef.current = [];
      setDraftId(savedDraft.draft_id);
      setDraftVersion(savedDraft.version);
      setDraftStatus(savedDraft.status);
      setDraftSaveState('saved');
      setDraft(savedDraft.payload);
      setStep(Math.min(Math.max(savedDraft.current_step, 0), steps.length - 1));

      if (savedDraft.created_student_id) {
        setCreatedStudentId(savedDraft.created_student_id);
      }
      const candidates = await findDuplicateStudentCandidates(
        institutionId,
        savedDraft.payload.identity,
      );
      const newCandidates = candidates.filter(
        (candidate) => candidate.id !== savedDraft.created_student_id,
      );
      setDuplicates(newCandidates);
      if (newCandidates.length > 0) {
        setStep(0);
        setError('Encontramos possíveis cadastros existentes. Revise antes de continuar este rascunho.');
      }
    } catch {
      setError('Não foi possível reabrir ou validar o rascunho. Tente novamente; os dados salvos não foram apagados.');
    } finally {
      setIsLoadingSavedDraft(false);
    }
  }

  async function discardCurrentDraft() {
    const saved = persistentDraftRef.current;
    if (!saved.id || !saved.version || saved.status !== 'OPEN') return;
    if (!window.confirm('Descartar este rascunho? Ele será marcado como descartado e não criará nenhum cadastro.')) return;
    setIsDiscardingDraft(true);
    setError(null);
    try {
      await discardDraftMutation.mutateAsync({
        institutionId,
        draftId: saved.id,
        expectedVersion: saved.version,
      });
      persistentDraftRef.current = { id: null, version: null, status: 'OPEN' };
      lastPersistedFingerprintRef.current = null;
      duplicateApprovalFingerprintRef.current = null;
      duplicateApprovalCandidateIdsRef.current = [];
      setDraftId(null);
      setDraftVersion(null);
      setDraftStatus('OPEN');
      setDraftSaveState('idle');
      setDraft(createDraft(firstYear, firstClassId));
      setStep(0);
      setDuplicates([]);
    } catch {
      setError('Não foi possível descartar o rascunho. Atualize a lista e tente novamente.');
    } finally {
      setIsDiscardingDraft(false);
    }
  }

  async function discardListedDraft(
    savedDraft: { draft_id: string; student_name: string; version: number },
  ) {
    if (!window.confirm(`Descartar o rascunho de “${savedDraft.student_name}”? Nenhum cadastro será criado.`)) return;
    try {
      await discardDraftMutation.mutateAsync({
        institutionId,
        draftId: savedDraft.draft_id,
        expectedVersion: savedDraft.version,
      });
      if (savedDraft.draft_id === persistentDraftRef.current.id) {
        persistentDraftRef.current = { id: null, version: null, status: 'OPEN' };
        lastPersistedFingerprintRef.current = null;
        setDraftId(null);
        setDraftVersion(null);
        setDraftStatus('OPEN');
        setDraftSaveState('idle');
        setDraft(createDraft(firstYear, firstClassId));
        setStep(0);
      }
    } catch {
      setError('Não foi possível descartar o rascunho. Atualize a lista e tente novamente.');
    }
  }

  async function closeWizard() {
    if (mode === 'create' && hasMeaningfulEnrollmentDraft(draft)) {
      try {
        await persistEnrollmentDraft(draft, step);
      } catch {
        setError('O rascunho não foi salvo. Mantenha esta janela aberta e tente novamente antes de sair.');
        return;
      }
    }
    onClose();
  }

  function updateIdentity(
    field: keyof FullStudentEnrollmentDraft['identity'],
    value: string,
  ) {
    duplicateApprovalFingerprintRef.current = null;
    duplicateApprovalCandidateIdsRef.current = [];
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

  function updateDocument(
    index: number,
    patch: Partial<StudentDocumentDraft>,
  ) {
    setDraft((current) => ({
      ...current,
      documents: current.documents.map((document, documentIndex) =>
        documentIndex === index ? { ...document, ...patch } : document,
      ),
    }));
  }

  async function openStoredDocument(filePath: string) {
    try {
      const signedUrl = await createStudentDocumentSignedUrl(filePath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (documentError) {
      setError(getUserFacingErrorMessage(documentError, 'Não foi possível abrir o documento armazenado.'));
    }
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
      const email = draft.identity.email.trim();
      const studentHasNoAccount = isEditMode && editorQuery.data?.studentProfileId === null;
      const emailCanBeEmpty = mode === 'enroll' || (mode === 'create' && !isEditMode) || studentHasNoAccount;
      if (!emailCanBeEmpty && !email) return 'Informe um e-mail válido para o aluno.';
      if (email && !/^\S+@\S+\.\S+$/.test(email)) return 'Informe um e-mail válido ou deixe o campo vazio.';
      if (studentHasNoAccount && email) return 'Este aluno não possui conta de acesso. Mantenha o e-mail vazio para preservar esse cadastro.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.identity.birth_date)) return 'Informe a data de nascimento do aluno.';
    }
    if (step === 2) {
      if (!isEditMode && draft.guardians.length === 0) return 'Associe pelo menos um responsável.';
      for (const guardian of draft.guardians) {
        if (guardian.mode === 'existing' && !guardian.profile_id) return 'Selecione o responsável existente ou escolha Novo responsável.';
        if (guardian.mode === 'new' && guardian.full_name.trim().length < 3) return 'Informe o nome do novo responsável.';
        if (guardian.mode === 'new' && !/^\S+@\S+\.\S+$/.test(guardian.email.trim())) return 'Informe um e-mail válido para o novo responsável.';
        if (guardian.relationship.trim().length < 2) return 'Informe o parentesco de cada responsável.';
      }
      if (draft.guardians.length > 0 && !draft.guardians.some((guardian) => guardian.is_primary)) return 'Marque um responsável principal.';
    }
    if (step === 5) {
      const missingJustification = draft.documents.find(
        (document) =>
          ['REJECTED', 'DISPENSED'].includes(document.status) &&
          !document.notes.trim(),
      );
      if (missingJustification) {
        return `Informe uma justificativa para o documento “${missingJustification.document_type}”.`;
      }
    }
    if (step === 6) {
      if (!isExistingStudentMode || editEnrollmentId || mode === 'enroll') {
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
    if (step === 0 && !isExistingStudentMode) {
      setIsCheckingDuplicates(true);
      try {
        const identityFingerprint = JSON.stringify([
          draft.identity.full_name.trim().toLocaleLowerCase('pt-BR'),
          draft.identity.birth_date,
          draft.identity.cpf.replace(/\D/g, ''),
        ]);
        const candidates = await findDuplicateStudentCandidates(
          institutionId,
          draft.identity,
        );
        if (candidates.length > 0) {
          duplicateApprovalFingerprintRef.current = null;
          duplicateApprovalCandidateIdsRef.current = [];
          setDuplicates(candidates);
          setError('Encontramos possíveis cadastros existentes. Revise antes de continuar.');
          return;
        }
        duplicateApprovalFingerprintRef.current = identityFingerprint;
        duplicateApprovalCandidateIdsRef.current = [];
      } catch (duplicateError) {
        setError(getUserFacingErrorMessage(duplicateError, 'Não foi possível verificar duplicidade.'));
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
    duplicateApprovalFingerprintRef.current = JSON.stringify([
      draft.identity.full_name.trim().toLocaleLowerCase('pt-BR'),
      draft.identity.birth_date,
      draft.identity.cpf.replace(/\D/g, ''),
    ]);
    duplicateApprovalCandidateIdsRef.current = duplicates.map((candidate) => candidate.id);
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
        setError('Os dados do aluno ainda não foram carregados.');
        return;
      }

      try {
        await updateMutation.mutateAsync({
          institutionId,
          studentId,
          enrollmentId: editEnrollmentId,
          draft,
        });
        if (registerInInclusiveEducation && !(await registerStudentInInclusiveEducation(studentId))) return;
        onCompleted();
      } catch (submitError) {
        setError(getUserFacingErrorMessage(submitError, 'Não foi possível atualizar o cadastro completo do aluno.'));
      }
      return;
    }

    if (mode === 'enroll') {
      if (!studentId) {
        setError('O aluno selecionado não foi identificado.');
        return;
      }

      try {
        const result = await createMutation.mutateAsync({
          institutionId,
          draft,
          existingStudentId: studentId,
        });
        if (registerInInclusiveEducation && !(await registerStudentInInclusiveEducation(result.student_id))) return;
        onCompleted();
      } catch (submitError) {
        setError(getUserFacingErrorMessage(submitError, 'Não foi possível concluir a matrícula.'));
      }
      return;
    }

    try {
      const latestIdentityFingerprint = JSON.stringify([
        draft.identity.full_name.trim().toLocaleLowerCase('pt-BR'),
        draft.identity.birth_date,
        draft.identity.cpf.replace(/\D/g, ''),
      ]);
      if (duplicateApprovalFingerprintRef.current !== latestIdentityFingerprint) {
        setIsCheckingDuplicates(true);
        try {
          const candidates = await findDuplicateStudentCandidates(
            institutionId,
            draft.identity,
          );
          const actionableCandidates = candidates.filter(
            (candidate) => candidate.id !== createdStudentId,
          );
          if (actionableCandidates.length > 0) {
            duplicateApprovalCandidateIdsRef.current = [];
            setDuplicates(actionableCandidates);
            setStep(0);
            setError('Encontramos possíveis cadastros existentes. Revise antes de confirmar a matrícula.');
            return;
          }
          duplicateApprovalFingerprintRef.current = latestIdentityFingerprint;
          duplicateApprovalCandidateIdsRef.current = [];
        } catch {
          setStep(0);
          setError('Não foi possível revalidar possíveis duplicidades. A matrícula não foi confirmada.');
          return;
        } finally {
          setIsCheckingDuplicates(false);
        }
      }

      const savedDraft = await persistEnrollmentDraft(draft, step);
      if (!savedDraft) {
        setError('Não foi possível salvar o rascunho seguro antes da confirmação.');
        return;
      }
      const result = await createMutation.mutateAsync({
        institutionId,
        draft,
        existingStudentId: createdStudentId,
        draftId: savedDraft.draft_id,
        draftVersion: savedDraft.version,
        duplicateApprovalCandidateIds: duplicateApprovalCandidateIdsRef.current,
      });
      if (registerInInclusiveEducation && !(await registerStudentInInclusiveEducation(result.student_id))) {
        setCreatedStudentId(result.student_id);
        return;
      }
      onCompleted();
    } catch (submitError) {
      if (submitError instanceof FullStudentEnrollmentError) {
        if (submitError.message.includes('STUDENT_DUPLICATE_REVIEW_REQUIRED') ||
          submitError.message.includes('STUDENT_DUPLICATE_REVIEW_STALE')) {
          duplicateApprovalFingerprintRef.current = null;
          duplicateApprovalCandidateIdsRef.current = [];
          try {
            const candidates = await findDuplicateStudentCandidates(
              institutionId,
              draft.identity,
            );
            const actionableCandidates = candidates.filter(
              (candidate) => candidate.id !== submitError.studentId,
            );
            setDuplicates(actionableCandidates);
            setStep(0);
            setError(actionableCandidates.length > 0
              ? 'A lista de possíveis duplicidades mudou. Revise os cadastros antes de confirmar.'
              : 'A validação de duplicidade mudou durante a confirmação. Revise os dados e tente novamente.');
          } catch {
            setError('Não foi possível atualizar a verificação de duplicidade. A matrícula não foi confirmada.');
          }
          if (submitError.studentId) setCreatedStudentId(submitError.studentId);
          setDraft((current) => ({
            ...current,
            guardians: current.guardians.map((guardian, index) => ({
              ...guardian,
              profile_id: guardian.profile_id || submitError.guardianProfileIds[index] || '',
            })),
          }));
          if (submitError.studentId || Object.keys(submitError.guardianProfileIds).length > 0) {
            setError((currentError) => currentError
              ? `${currentError} Os registros já criados foram preservados e serão reutilizados na nova tentativa.`
              : 'Os registros já criados foram preservados e serão reutilizados na nova tentativa.');
          }
          return;
        }
        if (submitError.studentId) setCreatedStudentId(submitError.studentId);
        setDraft((current) => ({
          ...current,
          guardians: current.guardians.map((guardian, index) => ({
            ...guardian,
            profile_id: guardian.profile_id || submitError.guardianProfileIds[index] || '',
          })),
        }));
        const failureReason = getUserFacingErrorMessage(
          submitError,
          'Não foi possível concluir a matrícula. Revise os dados e tente novamente.',
        );
        const hasRecoverableRecords = Boolean(
          submitError.studentId || Object.keys(submitError.guardianProfileIds).length,
        );
        setError(
          hasRecoverableRecords
            ? `${failureReason} Os registros já criados foram preservados e serão reutilizados na nova tentativa.`
            : failureReason,
        );
      } else {
        setError(getUserFacingErrorMessage(submitError, 'Não foi possível concluir a matrícula.'));
      }
    }
  }

  async function registerStudentInInclusiveEducation(targetStudentId: string): Promise<boolean> {
    if (inclusiveEducationRegistered) return true;
    try {
      await registerStudentForInclusiveEducation(institutionId, targetStudentId);
      setInclusiveEducationRegistered(true);
      return true;
    } catch {
      setStep(4);
      setError('O cadastro foi salvo, mas a inclusão na Educação Inclusiva não foi confirmada. Confira a matrícula ativa do ano letivo atual e tente novamente.');
      return false;
    }
  }

  async function handleInclusiveEducationRegistration() {
    const existingStudentId = studentId ?? createdStudentId;
    if (!existingStudentId) {
      setRegisterInInclusiveEducation((current) => !current);
      return;
    }

    setIsRegisteringInclusiveEducation(true);
    setError(null);
    try {
      await registerStudentForInclusiveEducation(institutionId, existingStudentId);
      setRegisterInInclusiveEducation(true);
      setInclusiveEducationRegistered(true);
    } catch {
      setError('Não foi possível cadastrar na Educação Inclusiva. Confira se o aluno tem matrícula ativa no ano letivo atual e tente novamente.');
    } finally {
      setIsRegisteringInclusiveEducation(false);
    }
  }

  function renderIdentity() {
    const studentHasNoAccount = isEditMode && editorQuery.data?.studentProfileId === null;
    const studentEmailOptional = mode === 'enroll' || (mode === 'create' && !isEditMode) || studentHasNoAccount;
    const studentEmailReadOnly = mode === 'enroll' || studentHasNoAccount;
    const emailHint = studentHasNoAccount
      ? 'Este aluno foi cadastrado sem conta de acesso; o e-mail permanece vazio.'
      : mode === 'create'
        ? 'Deixe vazio para cadastrar o aluno sem criar conta, perfil de acesso ou e-mail fictício.'
        : 'A matrícula de um aluno já cadastrado não cria nem altera o acesso ao sistema.';
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nome completo *"><input className={inputClass} value={draft.identity.full_name} onChange={(event) => updateIdentity('full_name', event.target.value)} /></Field>
        <Field
          label={studentEmailOptional ? 'E-mail do aluno (opcional)' : 'E-mail *'}
          hint={studentEmailOptional ? emailHint : undefined}
        >
          <input
            type="email"
            className={inputClass}
            value={draft.identity.email}
            onChange={(event) => updateIdentity('email', event.target.value)}
            readOnly={studentEmailReadOnly}
            placeholder={studentHasNoAccount ? 'Sem conta de acesso' : undefined}
          />
        </Field>
        <Field label="Data de nascimento *"><input type="date" className={inputClass} value={draft.identity.birth_date} onChange={(event) => updateIdentity('birth_date', event.target.value)} /></Field>
        <Field label="CPF"><input className={inputClass} value={draft.identity.cpf} onChange={(event) => updateIdentity('cpf', event.target.value)} /></Field>
        <Field label="Nome social"><input className={inputClass} value={draft.identity.social_name} onChange={(event) => updateIdentity('social_name', event.target.value)} /></Field>
        <Field label="Telefone"><input className={inputClass} value={draft.identity.phone} onChange={(event) => updateIdentity('phone', event.target.value)} /></Field>
        <Field label="RG"><input className={inputClass} value={draft.identity.rg} onChange={(event) => updateIdentity('rg', event.target.value)} /></Field>
        <Field label="Órgão expedidor"><input className={inputClass} value={draft.identity.rg_issuing_authority} onChange={(event) => updateIdentity('rg_issuing_authority', event.target.value)} /></Field>
        <Field label="UF do RG"><input maxLength={2} className={inputClass} value={draft.identity.rg_state} onChange={(event) => updateIdentity('rg_state', event.target.value.toUpperCase())} /></Field>
        <Field label="Certidão de nascimento"><input className={inputClass} value={draft.identity.birth_certificate} onChange={(event) => updateIdentity('birth_certificate', event.target.value)} /></Field>
        <Field label="Nacionalidade"><input className={inputClass} value={draft.identity.nationality} onChange={(event) => updateIdentity('nationality', event.target.value)} /></Field>
        <Field label="Naturalidade"><input className={inputClass} value={draft.identity.birthplace} onChange={(event) => updateIdentity('birthplace', event.target.value)} /></Field>
        <Field label="UF de nascimento"><input maxLength={2} className={inputClass} value={draft.identity.birth_state} onChange={(event) => updateIdentity('birth_state', event.target.value.toUpperCase())} /></Field>
        <Field label="Sexo"><select className={inputClass} value={draft.identity.sex} onChange={(event) => updateIdentity('sex', event.target.value)}><option value="">Não informado</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option></select></Field>
      </div>
    );
  }

  function renderAddress() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="CEP"><input className={inputClass} value={draft.address.postal_code} onChange={(event) => updateAddress('postal_code', event.target.value)} /></Field>
        <Field label="Logradouro"><input className={inputClass} value={draft.address.street} onChange={(event) => updateAddress('street', event.target.value)} /></Field>
        <Field label="Número"><input className={inputClass} value={draft.address.number} onChange={(event) => updateAddress('number', event.target.value)} /></Field>
        <Field label="Complemento"><input className={inputClass} value={draft.address.complement} onChange={(event) => updateAddress('complement', event.target.value)} /></Field>
        <Field label="Bairro"><input className={inputClass} value={draft.address.neighborhood} onChange={(event) => updateAddress('neighborhood', event.target.value)} /></Field>
        <Field label="Cidade"><input className={inputClass} value={draft.address.city} onChange={(event) => updateAddress('city', event.target.value)} /></Field>
        <Field label="UF"><input maxLength={2} className={inputClass} value={draft.address.state} onChange={(event) => updateAddress('state', event.target.value.toUpperCase())} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={draft.address.rural_zone} onChange={(event) => updateAddress('rural_zone', event.target.checked)} /> Zona rural</label>
      </div>
    );
  }

  function renderGuardians() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">Associe um ou mais responsáveis. O principal será usado como contato prioritário.</p>
        {draft.guardians.map((guardian, index) => {
          const matchingGuardian = guardian.mode === 'new'
            ? guardians.find((user) => user.profile?.email?.trim().toLowerCase() === guardian.email.trim().toLowerCase())
            : undefined;

          return (
            <div key={`${index}-${guardian.profile_id}`} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm text-slate-800 dark:text-slate-100">Responsável {index + 1}</strong>{draft.guardians.length > 1 ? <button type="button" className="text-sm text-red-600 dark:text-red-300" onClick={() => removeGuardian(index)}>Remover</button> : null}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Origem"><select className={inputClass} value={guardian.mode} onChange={(event) => updateGuardian(index, { mode: event.target.value as GuardianDraft['mode'], profile_id: '' })}><option value="existing">Responsável já cadastrado</option><option value="new">Novo responsável</option></select></Field>
                {guardian.mode === 'existing' ? <Field label="Responsável"><select className={inputClass} value={guardian.profile_id} onChange={(event) => updateGuardian(index, { profile_id: event.target.value })}><option value="">Selecione</option>{guardians.map((user) => <option key={user.profile_id} value={user.profile_id}>{user.profile?.full_name ?? user.profile?.email}</option>)}</select></Field> : <><Field label="Nome completo *"><input className={inputClass} value={guardian.full_name} onChange={(event) => updateGuardian(index, { full_name: event.target.value })} /></Field><Field label="E-mail *"><input type="email" className={inputClass} value={guardian.email} onChange={(event) => updateGuardian(index, { email: event.target.value })} /></Field><Field label="Telefone"><input className={inputClass} value={guardian.phone} onChange={(event) => updateGuardian(index, { phone: event.target.value })} /></Field></>}
                <Field label="Parentesco *"><select className={inputClass} value={guardian.relationship} onChange={(event) => updateGuardian(index, { relationship: event.target.value })}><option value="">Selecione o parentesco</option>{guardian.relationship && !guardianRelationshipOptions.includes(guardian.relationship) && <option value={guardian.relationship}>{guardian.relationship}</option>}{guardianRelationshipOptions.map((relationship) => <option key={relationship} value={relationship}>{relationship}</option>)}</select></Field>
              </div>
              {matchingGuardian ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"><p>Já existe um responsável com este e-mail: <strong>{matchingGuardian.profile?.full_name ?? matchingGuardian.profile?.email}</strong>.</p><button type="button" className="mt-2 rounded-lg border border-amber-700 px-3 py-2 font-semibold dark:border-amber-500 dark:text-amber-300" onClick={() => updateGuardian(index, { mode: 'existing', profile_id: matchingGuardian.profile_id })}>Usar cadastro existente</button></div> : null}
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="radio" name="primary-guardian" checked={guardian.is_primary} onChange={() => setPrimaryGuardian(index)} /> Responsável principal</label>
            </div>
          );
        })}
        <button type="button" className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700" onClick={addGuardian}>+ Adicionar responsável</button>
      </div>
    );
  }

  function renderPreviousSchooling() {
    const previous = draft.previous_schooling;
    const update = (field: keyof typeof previous, value: string | boolean) => setDraft((current) => ({ ...current, previous_schooling: { ...current.previous_schooling, [field]: value } }));
    return <div className="grid gap-4 md:grid-cols-2"><Field label="Escola de origem"><input className={inputClass} value={previous.origin_school} onChange={(event) => update('origin_school', event.target.value)} /></Field><Field label="Rede de ensino"><input className={inputClass} value={previous.origin_network} onChange={(event) => update('origin_network', event.target.value)} /></Field><Field label="Cidade"><input className={inputClass} value={previous.city} onChange={(event) => update('city', event.target.value)} /></Field><Field label="UF"><input maxLength={2} className={inputClass} value={previous.state} onChange={(event) => update('state', event.target.value.toUpperCase())} /></Field><Field label="Última série"><input className={inputClass} value={previous.last_grade} onChange={(event) => update('last_grade', event.target.value)} /></Field><Field label="Ano de origem"><input type="number" className={inputClass} value={previous.origin_year} onChange={(event) => update('origin_year', event.target.value)} /></Field><Field label="Situação"><input className={inputClass} value={previous.status} onChange={(event) => update('status', event.target.value)} /></Field><Field label="Observações"><textarea className={inputClass} value={previous.observations} onChange={(event) => update('observations', event.target.value)} /></Field><label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={previous.history_delivered} onChange={(event) => update('history_delivered', event.target.checked)} /> Histórico entregue</label><label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><input type="checkbox" checked={previous.transfer_declaration} onChange={(event) => update('transfer_declaration', event.target.checked)} /> Declaração de transferência entregue</label></div>;
  }

  function renderHealth() {
    const health = draft.health;
    const update = (field: keyof typeof health, value: string | boolean) => setDraft((current) => ({ ...current, health: { ...current.health, [field]: value } }));
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          Dados de saúde são sensíveis e ficam restritos a ADMIN, DIRECTOR e SECRETARY.
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Alergias"><textarea className={inputClass} value={health.allergies} onChange={(event) => update('allergies', event.target.value)} /></Field>
          <Field label="Condições de saúde"><textarea className={inputClass} value={health.health_conditions} onChange={(event) => update('health_conditions', event.target.value)} /></Field>
          <Field label="Medicação de emergência"><textarea className={inputClass} value={health.emergency_medication} onChange={(event) => update('emergency_medication', event.target.value)} /></Field>
          <Field label="Deficiência ou necessidade"><textarea className={inputClass} value={health.disability} onChange={(event) => update('disability', event.target.value)} /></Field>
          <Field label="Cuidados na escola"><textarea className={inputClass} value={health.school_care_notes} onChange={(event) => update('school_care_notes', event.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-200">
          <label className="flex items-center gap-2"><input type="checkbox" checked={health.autism} onChange={(event) => update('autism', event.target.checked)} /> TEA</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={health.giftedness} onChange={(event) => update('giftedness', event.target.checked)} /> Altas habilidades</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={health.needs_special_education} onChange={(event) => update('needs_special_education', event.target.checked)} /> Atendimento educacional especializado</label>
        </div>
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <h3 className="font-semibold text-slate-900 dark:text-white">Educação Inclusiva</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
            Esta decisão pedagógica é separada dos dados de saúde. Ao concluir e salvar o cadastro, o aluno será incluído no PEI e ficará disponível também em Evolução Pedagógica.
          </p>
          <button
            type="button"
            aria-pressed={registerInInclusiveEducation}
            onClick={() => void handleInclusiveEducationRegistration()}
            disabled={isRegisteringInclusiveEducation || inclusiveEducationRegistered}
            className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-default ${registerInInclusiveEducation ? 'bg-emerald-700 text-white disabled:bg-emerald-700' : 'border border-blue-700 bg-white text-blue-800 hover:bg-blue-100 disabled:opacity-70 dark:border-blue-400 dark:bg-slate-900 dark:text-blue-200'}`}
          >
            {isRegisteringInclusiveEducation
              ? 'Cadastrando...'
              : inclusiveEducationRegistered
                ? 'Aluno incluído no PEI'
                : registerInInclusiveEducation
                  ? 'Inclusão será concluída ao salvar o cadastro'
                  : 'Cadastrar aluno na Educação Inclusiva'}
          </button>
          {inclusiveEducationRegistered
            ? <p role="status" className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">O aluno já está no PEI e ficará disponível em Evolução Pedagógica.</p>
            : registerInInclusiveEducation && <p role="status" className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">A inclusão será concluída ao salvar o cadastro completo.</p>}
        </section>
      </div>
    );
  }

  function renderDocuments() {
    const events = editorQuery.data?.documentStatusHistory ?? [];
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Os documentos são conferidos conforme a regra da instituição. Não solicitado não bloqueia a matrícula; rejeição e dispensa exigem justificativa.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Formatos aceitos: PDF, DOC, DOCX, JPG, PNG e WEBP. Limite de 10 MB por arquivo. Os arquivos ficam privados e vinculados ao cadastro do aluno.
        </p>
        {draft.documents.map((document, index) => (
          <div key={document.document_type} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1.4fr)]">
              <span className="self-center text-sm font-medium text-slate-700 dark:text-slate-200">{document.document_type}</span>
              <select
                aria-label={`Status de ${document.document_type}`}
                className={inputClass}
                value={document.status}
                onChange={(event) => updateDocument(index, { status: event.target.value as StudentDocumentDraft['status'] })}
              >
                {Object.entries(documentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                className={inputClass}
                aria-label={`Observação de ${document.document_type}`}
                placeholder={['REJECTED', 'DISPENSED'].includes(document.status) ? 'Justificativa obrigatória' : 'Observação opcional'}
                value={document.notes}
                onChange={(event) => updateDocument(index, { notes: event.target.value })}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/30">
                <span>Selecionar arquivo</span>
                <input
                  type="file"
                  accept={STUDENT_DOCUMENT_ACCEPT}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    updateDocument(index, {
                      file,
                      ...(file ? { status: 'DELIVERED' } : {}),
                    });
                  }}
                />
              </label>
              {document.file && <span className="text-xs text-slate-600 dark:text-slate-300">Novo arquivo: {document.file.name}</span>}
              {document.file_path && !document.file && <>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Arquivo armazenado</span>
                <button type="button" className="text-xs font-semibold text-blue-700 underline dark:text-blue-300" onClick={() => void openStoredDocument(document.file_path as string)}>Abrir arquivo</button>
              </>}
            </div>
          </div>
        ))}
        {isExistingStudentMode && events.length > 0 && (
          <section aria-label="Histórico de conferência documental" className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Histórico de conferência</h3>
            <ol className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {events.slice(0, 10).map((event, index) => {
                const actor = usersQuery.data?.find((user) => user.profile_id === event.actor_profile_id);
                const changedAt = new Date(event.changed_at).toLocaleString('pt-BR');
                const transition = event.from_status
                  ? `${documentStatusLabels[event.from_status]} → ${documentStatusLabels[event.to_status]}`
                  : documentStatusLabels[event.to_status];
                return (
                  <li key={`${event.document_type}-${event.changed_at}-${index}`}>
                    {event.document_type}: {transition} · {changedAt} · {actor?.profile?.full_name ?? 'equipe autorizada'}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    );
  }

  function renderEnrollment() {
    const availableClasses = getActiveClassesForYear(
      activeClasses,
      draft.academic_year_id,
    );
    const classesWithSeats = availableClasses.filter(
      (classRecord) => !isClassAtCapacity(classRecord),
    );
    const classHint = !draft.academic_year_id
      ? 'Selecione o ano letivo para carregar as turmas.'
      : availableClasses.length === 0
        ? 'Nenhuma turma ativa cadastrada para este ano letivo.'
        : classesWithSeats.length === 0
          ? 'Todas as turmas deste ano estão lotadas.'
          : classesWithSeats.length > 1 && !draft.class_id
            ? 'Selecione uma das turmas disponíveis.'
            : undefined;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Ano letivo *"
          hint="O ano vigente é sugerido automaticamente."
        >
          <select
            className={inputClass}
            value={draft.academic_year_id}
            onChange={(event) => {
              const academicYearId = event.target.value;
              const nextClasses = getActiveClassesForYear(
                activeClasses,
                academicYearId,
              );

              setDraft((current) => ({
                ...current,
                academic_year_id: academicYearId,
                class_id: getSuggestedClassId(nextClasses),
              }));
            }}
          >
            <option value="">Selecione</option>
            {activeYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Turma *" hint={classHint}>
          <select
            className={inputClass}
            value={draft.class_id}
            disabled={
              !draft.academic_year_id ||
              classesWithSeats.length === 0
            }
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                class_id: event.target.value,
              }))
            }
          >
            <option value="">
              {classesWithSeats.length === 0
                ? 'Nenhuma turma disponível'
                : 'Selecione a turma'}
            </option>
            {availableClasses.map((classRecord) => {
              const full = isClassAtCapacity(classRecord);

              return (
                <option
                  key={classRecord.id}
                  value={classRecord.id}
                  disabled={full}
                >
                  {classRecord.name}
                  {classRecord.shift ? ` - ${classRecord.shift}` : ''}{' '}
                  ({classRecord.active_enrollments_count}/
                  {classRecord.capacity || 'sem limite'})
                  {full ? ' - lotada' : ''}
                </option>
              );
            })}
          </select>
        </Field>

        <Field label="Data da matrícula">
          <input
            type="date"
            className={inputClass}
            value={draft.enrolled_at}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                enrolled_at: event.target.value,
              }))
            }
          />
        </Field>

        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Status inicial: <strong>Ativa</strong>. Transferencia, cancelamento e
          conclusão continuam disponíveis no fluxo de matrículas.
        </div>
      </div>
    );
  }

  function renderReview() {
    const primary = draft.guardians.find((guardian) => guardian.is_primary);
    const year = years.find((item) => item.id === draft.academic_year_id);
    const classRecord = classes.find((item) => item.id === draft.class_id);
    const confirmationMessage = mode === 'enroll'
      ? 'Ao confirmar, os dados complementares e a nova matrícula serão persistidos para o aluno existente. Nenhum acesso será criado nem alterado.'
      : !draft.identity.email.trim()
        ? 'Ao confirmar, o cadastro e a matrícula serão persistidos sem criar e-mail fictício, conta de autenticação ou perfil de acesso para o aluno.'
        : 'Ao confirmar, o aluno, os responsáveis, os dados complementares e a matrícula serão persistidos. O acesso por e-mail será criado conforme o fluxo de autenticação.';
    const pendingDocuments = draft.documents.filter((document) => documentNeedsFollowUp(document.status)).length;
    return <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200"><div className="grid gap-3 md:grid-cols-2"><div><strong>Aluno</strong><p>{draft.identity.full_name}</p><p>{draft.identity.email || 'Sem conta de acesso por e-mail'}</p><p>{draft.identity.birth_date}</p></div><div><strong>Matrícula</strong><p>{year?.name ?? 'Ano não selecionado'}</p><p>{classRecord?.name ?? 'Turma não selecionada'}</p><p>{draft.enrolled_at}</p></div><div><strong>Responsável principal</strong><p>{primary?.full_name || (primary?.profile_id ? 'Responsável cadastrado' : 'Não informado')}</p><p>{primary?.relationship}</p></div><div><strong>Documentos aguardando providência</strong><p>{pendingDocuments}</p></div></div><div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">{confirmationMessage}</div></div>;
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

  if (isExistingStudentMode && editorQuery.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Editar aluno">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Carregando dados completos do aluno...</p>
        </div>
      </div>
    );
  }

  if (isExistingStudentMode && editorQuery.isError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Editar aluno">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
          <ErrorBox message={getUserFacingErrorMessage(editorQuery.error, 'Não foi possível carregar os dados do aluno.')} />
          <div className="mt-4 flex justify-end"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" onClick={onClose}>Fechar</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label={isExistingStudentMode ? (mode === 'enroll' ? 'Matricular aluno' : 'Editar aluno') : 'Matrícula completa de aluno'}>
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:border dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">{isExistingStudentMode ? (mode === 'enroll' ? 'Matricular aluno' : 'Editar aluno') : 'Novo aluno'}</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{mode === 'enroll' ? 'Concluir matrícula' : isEditMode ? 'Editar cadastro completo' : 'Matrícula completa'}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{mode === 'enroll' ? 'Revise os dados e escolha a turma para concluir a matrícula deste aluno.' : isEditMode ? 'Atualize todos os dados cadastrais, escolares e da matrícula.' : 'Cadastro detalhado com vínculos, documentos e revisão antes de confirmar.'}</p></div><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => void closeWizard()} aria-label="Fechar">X</button></div>
        {mode === 'create' ? (
          <div className="space-y-3 border-b border-slate-200 px-5 py-3 text-sm dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p aria-live="polite" role="status" className="text-slate-600 dark:text-slate-300">
                {draftStatus === 'FINALIZING'
                  ? 'Uma confirmação anterior está em andamento; os dados permanecem protegidos.'
                  : draftSaveState === 'saving'
                    ? 'Salvando rascunho seguro…'
                    : draftSaveState === 'saved'
                      ? 'Rascunho salvo com segurança nesta escola.'
                      : draftSaveState === 'error'
                        ? 'Falha ao salvar o rascunho. Não feche esta janela até a recuperação.'
                        : 'O rascunho será salvo automaticamente ao preencher os dados.'}
              </p>
              {draftId && draftStatus === 'OPEN' ? (
                <button type="button" className="text-xs font-semibold text-red-700 underline disabled:opacity-60 dark:text-red-300" onClick={() => void discardCurrentDraft()} disabled={isDiscardingDraft}>
                  {isDiscardingDraft ? 'Descartando…' : 'Descartar rascunho atual'}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rascunhos ficam no banco da escola e só podem ser retomados por equipe autorizada. Arquivos e links temporários não são salvos.
            </p>
            {(draftsQuery.data?.length ?? 0) > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Rascunhos para continuar</p>
                <div className="space-y-2">
                  {draftsQuery.data?.filter((savedDraft) => savedDraft.draft_id !== draftId).map((savedDraft) => (
                    <div key={savedDraft.draft_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 dark:bg-slate-900">
                      <span>{savedDraft.student_name} · etapa {savedDraft.current_step + 1} de 8 · {new Date(savedDraft.updated_at).toLocaleString()}</span>
                      <div className="flex gap-3">
                        <button type="button" className="font-semibold text-blue-700 underline disabled:opacity-60 dark:text-blue-300" onClick={() => void resumeSavedDraft(savedDraft.draft_id)} disabled={isLoadingSavedDraft || isDiscardingDraft}>
                          {isLoadingSavedDraft ? 'Abrindo…' : 'Retomar'}
                        </button>
                        {savedDraft.status === 'OPEN' ? (
                          <button type="button" className="font-semibold text-red-700 underline dark:text-red-300" onClick={() => void discardListedDraft(savedDraft)}>
                            Descartar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {draftsQuery.isError ? <p className="text-xs text-amber-700 dark:text-amber-300">Não foi possível carregar a lista de rascunhos salvos.</p> : null}
          </div>
        ) : null}
        <div className="overflow-y-auto px-5 py-4 dark:bg-slate-900"><div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-8">{steps.map((label, index) => <div key={label} className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ${index === step ? 'bg-blue-700 text-white' : index < step ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}><span className="block">{index + 1}</span>{label}</div>)}</div><div className="mb-4"><ErrorBox message={error} />{duplicates.length > 0 ? <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"><strong>Possíveis duplicidades</strong>{duplicates.map((candidate) => <div key={candidate.id} className="mt-2 rounded-lg border border-amber-300 bg-white/70 p-3 dark:border-amber-800 dark:bg-slate-900/70"><p className="font-semibold">{candidate.full_name}</p><p className="mt-1">Matrícula {candidate.registration_number} - {candidate.birth_date}</p>{onUseExistingStudent ? <button type="button" className="mt-2 rounded-lg border border-blue-600 px-3 py-2 font-semibold text-blue-700 dark:border-blue-500 dark:text-blue-300" onClick={() => onUseExistingStudent(candidate.id)}>Usar este cadastro</button> : null}</div>)}<div className="mt-3 flex flex-wrap gap-2"><button type="button" className="rounded-lg border border-slate-400 bg-white px-3 py-2 font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" onClick={() => setDuplicates([])}>Voltar e revisar</button><button type="button" className="rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white" onClick={continueAfterDuplicateCheck}>Continuar mesmo assim</button></div></div> : null}</div><div className="min-h-[300px]">{renderStep()}</div></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" onClick={step === 0 ? () => void closeWizard() : () => { setError(null); setStep((current) => current - 1); }}>{step === 0 ? 'Cancelar' : 'Voltar'}</button><div className="flex gap-2"><span className="self-center text-xs text-slate-500 dark:text-slate-400">Etapa {step + 1} de {steps.length}</span>{step < steps.length - 1 ? <button type="button" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={next} disabled={isCheckingDuplicates || isLoadingSavedDraft}>{isCheckingDuplicates ? 'Verificando...' : isLoadingSavedDraft ? 'Abrindo rascunho…' : 'Continuar'}</button> : <button type="button" className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={submit} disabled={createMutation.isPending || updateMutation.isPending || isCheckingDuplicates || isLoadingSavedDraft || draftSaveState === 'saving'}>{createMutation.isPending || updateMutation.isPending ? 'Salvando...' : isCheckingDuplicates || draftSaveState === 'saving' ? 'Validando e salvando…' : mode === 'enroll' ? 'Confirmar matrícula' : isEditMode ? 'Salvar alterações' : 'Confirmar matrícula'}</button>}</div></div>
      </div>
    </div>
  );
}

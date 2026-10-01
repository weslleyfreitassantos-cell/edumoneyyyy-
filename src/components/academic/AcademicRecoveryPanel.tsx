import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardPenLine } from 'lucide-react';

import {
  useAcademicRecoveryCandidates,
  useCancelAcademicRecovery,
  useSaveAcademicRecovery,
} from '../../hooks/useAcademicRecovery';
import { useTeacherTermClosureOfferings } from '../../hooks/useAcademicTermClosing';
import {
  academicRecoveryService,
  type AcademicRecoveryCandidate,
} from '../../services/academicRecoveryService';
import type { TermResultStatus } from '../../services/academicCalculations';

const RESULT_LABELS: Record<TermResultStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  FAILED_BY_GRADE: 'Reprovado por nota',
  FAILED_BY_ATTENDANCE: 'Reprovado por frequência',
  FAILED_BY_GRADE_AND_ATTENDANCE: 'Reprovado por nota e frequência',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.';
}

function parsePercentage(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : null;
}

function formatPercentage(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

const EMPTY_RECOVERY_CANDIDATES: AcademicRecoveryCandidate[] = [];

function RecoveryRow({
  candidate,
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isCanceling,
  readOnly,
}: {
  candidate: AcademicRecoveryCandidate;
  value: string;
  onChange: (value: string) => void;
  onSave: (status: 'DRAFT' | 'PUBLISHED') => void;
  onCancel: () => void;
  isSaving: boolean;
  isCanceling: boolean;
  readOnly: boolean;
}) {
  const isPublished = candidate.recovery?.status === 'PUBLISHED';
  const isCanceled = candidate.recovery?.status === 'CANCELED';
  const canEdit = !readOnly && !isPublished && !isCanceled;
  const canCancel = !readOnly && (
    candidate.recovery?.status === 'DRAFT' ||
    candidate.recovery?.status === 'PUBLISHED'
  );
  const typedPercentage = parsePercentage(value);
  const preview = academicRecoveryService.calculatePreview(
    candidate,
    typedPercentage,
  );

  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="break-words font-bold text-[#181c20] dark:text-white">
            {candidate.student.fullName}
          </h3>
          <p className="mt-1 text-sm text-[#727785] dark:text-slate-400">
            RA {candidate.student.registrationNumber}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {RESULT_LABELS[candidate.originalResultStatus]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-[#727785] dark:text-slate-400">Média original</dt>
          <dd className="mt-1 font-semibold text-[#181c20] dark:text-slate-100">
            {formatPercentage(candidate.originalGradePercentage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[#727785] dark:text-slate-400">Frequência</dt>
          <dd className="mt-1 font-semibold text-[#181c20] dark:text-slate-100">
            {formatPercentage(candidate.attendancePercentage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[#727785] dark:text-slate-400">Média projetada</dt>
          <dd className="mt-1 font-semibold text-[#181c20] dark:text-slate-100">
            {formatPercentage(preview.finalGradePercentage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[#727785] dark:text-slate-400">Situação projetada</dt>
          <dd className="mt-1 font-semibold text-[#181c20] dark:text-slate-100">
            {RESULT_LABELS[preview.resultStatus]}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,14rem)_1fr] lg:items-end">
        <div>
          <label
            htmlFor={`recovery-${candidate.student.id}`}
            className="text-sm font-semibold text-[#3d4652] dark:text-slate-200"
          >
            Recuperação (%)
          </label>
          <input
            id={`recovery-${candidate.student.id}`}
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={!canEdit || isSaving || isCanceling}
            className="mt-1 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSave('DRAFT')}
            disabled={!canEdit || typedPercentage === null || isSaving || isCanceling}
            className="inline-flex items-center justify-center rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-semibold text-[#005bbf] transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[#005bbf] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-800"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => onSave('PUBLISHED')}
            disabled={!canEdit || typedPercentage === null || isSaving || isCanceling}
            className="inline-flex items-center justify-center rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#004a99] focus:outline-none focus:ring-2 focus:ring-[#005bbf] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Publicar recuperação'}
          </button>
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving || isCanceling}
              className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              {isCanceling ? 'Cancelando...' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>

      {candidate.recovery && (
        <p className="mt-3 text-xs text-[#727785] dark:text-slate-400">
          Status salvo: {candidate.recovery.status === 'PUBLISHED' ? 'Publicado' : candidate.recovery.status === 'DRAFT' ? 'Rascunho' : 'Cancelado'}.
        </p>
      )}
    </article>
  );
}

export default function AcademicRecoveryPanel({
  profileId,
  institutionId,
}: {
  profileId: string | undefined;
  institutionId: string | undefined;
}) {
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const offeringsQuery = useTeacherTermClosureOfferings(profileId, institutionId);
  const offerings = offeringsQuery.data ?? [];

  useEffect(() => {
    if (
      offerings.length > 0 &&
      !offerings.some((offering) => offering.id === selectedOfferingId)
    ) {
      setSelectedOfferingId(offerings[0].id);
    }
  }, [offerings, selectedOfferingId]);

  const candidatesQuery = useAcademicRecoveryCandidates(
    institutionId,
    selectedOfferingId || undefined,
  );
  const candidates =
    candidatesQuery.data ?? EMPTY_RECOVERY_CANDIDATES;
  const saveMutation = useSaveAcademicRecovery();
  const cancelMutation = useCancelAcademicRecovery();
  const selectedOffering = offerings.find((offering) => offering.id === selectedOfferingId);
  const closureStatus = selectedOffering?.closure?.status;
  const recoveryAvailable = closureStatus === 'REOPENED';
  const periodClosed = closureStatus === 'CLOSED';
  const readOnly = !recoveryAvailable;

  useEffect(() => {
    setValues(
      Object.fromEntries(
        candidates.map((candidate) => [
          candidate.student.id,
          candidate.recovery?.status !== 'CANCELED'
            ? String(candidate.recovery?.recoveryPercentage ?? '')
            : '',
        ]),
      ),
    );
  }, [candidates]);

  const saveCandidate = async (
    candidate: AcademicRecoveryCandidate,
    status: 'DRAFT' | 'PUBLISHED',
  ) => {
    if (!institutionId || !selectedOfferingId) return;
    const percentage = parsePercentage(values[candidate.student.id] ?? '');
    if (percentage === null) return;

    setSuccessMessage('');
    await saveMutation.mutateAsync({
      institutionId,
      academicYearId: selectedOffering?.academicYearId ?? '',
      termId: selectedOffering?.termId ?? '',
      subjectOfferingId: selectedOfferingId,
      studentId: candidate.student.id,
      recoveryPercentage: percentage,
      status,
    });
    setSuccessMessage(status === 'PUBLISHED'
      ? 'Recuperação publicada com sucesso.'
      : 'Rascunho salvo com sucesso.');
  };

  const candidateRows = useMemo(
    () => candidates.map((candidate) => (
      <div key={candidate.student.id}>
        <RecoveryRow
          candidate={candidate}
          value={values[candidate.student.id] ?? ''}
          onChange={(value) => setValues((current) => ({ ...current, [candidate.student.id]: value }))}
          onSave={(status) => void saveCandidate(candidate, status)}
          onCancel={() => {
            if (candidate.recovery && institutionId) {
              void cancelMutation.mutateAsync({ institutionId, recoveryId: candidate.recovery.id });
            }
          }}
          isSaving={saveMutation.isPending}
          isCanceling={cancelMutation.isPending}
          readOnly={readOnly}
        />
      </div>
    )),
    [candidates, values, institutionId, readOnly, saveMutation.isPending, cancelMutation.isPending],
  );

  return (
    <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <ClipboardPenLine className="mt-0.5 h-5 w-5 shrink-0 text-[#005bbf]" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold text-[#181c20] dark:text-white">Recuperação acadêmica</h2>
          <p className="mt-1 text-sm text-[#727785] dark:text-slate-400">
            Registre recuperação de nota somente para alunos reprovados por desempenho.
          </p>
        </div>
      </div>

      <label htmlFor="academic-recovery-offering" className="mt-5 block text-sm font-semibold text-[#3d4652] dark:text-slate-200">
        Oferta e período
      </label>
      <select
        id="academic-recovery-offering"
        value={selectedOfferingId}
        onChange={(event) => {
          setSelectedOfferingId(event.target.value);
          setSuccessMessage('');
        }}
        className="mt-1 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2 text-sm text-[#181c20] dark:border-slate-600 dark:bg-slate-950 dark:text-white"
      >
        <option value="">Selecione...</option>
        {offerings.map((offering) => (
          <option key={offering.id} value={offering.id}>
            {offering.subjectName} · {offering.className} · {offering.termName}
          </option>
        ))}
      </select>

      {successMessage && (
        <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {successMessage}
        </div>
      )}
      {saveMutation.isError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{getErrorMessage(saveMutation.error)}</div>}
      {cancelMutation.isError && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{getErrorMessage(cancelMutation.error)}</div>}
      {periodClosed && <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">O período está fechado. Reabra o fechamento pelo fluxo autorizado para registrar alterações.</div>}
      {!periodClosed && !recoveryAvailable && selectedOfferingId && <div role="status" className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">A recuperação ficará disponível após o fechamento inicial do período e sua reabertura pelo fluxo autorizado.</div>}
      {candidatesQuery.isLoading && selectedOfferingId && <div className="mt-5 rounded-lg border border-dashed border-[#c1c6d6] p-5 text-sm text-[#727785] dark:border-slate-600 dark:text-slate-400">Carregando alunos elegíveis...</div>}
      {candidatesQuery.isError && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{getErrorMessage(candidatesQuery.error)}</div>}
      {!candidatesQuery.isLoading && !candidatesQuery.isError && selectedOfferingId && candidates.length === 0 && <div className="mt-5 rounded-lg border border-dashed border-[#c1c6d6] p-5 text-sm text-[#727785] dark:border-slate-600 dark:text-slate-400">Nenhum aluno precisa de recuperação por nota neste período.</div>}
      {candidates.length > 0 && <div className="mt-5 space-y-3">{candidateRows}</div>}
    </section>
  );
}

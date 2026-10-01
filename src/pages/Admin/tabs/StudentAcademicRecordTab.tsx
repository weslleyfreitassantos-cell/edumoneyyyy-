import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { useStudentAcademicRecord } from '../../../hooks/useStudentAcademicRecord';
import { formatPercent, getResultBadgeClass, getResultStatusLabel } from '../../../components/academic/academicDisplay';
import { getUserFacingErrorMessage } from '../../../lib/userFacingError';
import type { ReportCardSubjectResult } from '../../../services/reportCardService';
import type { PedagogicalRiskLevel } from '../../../services/pedagogicalMonitoringService';

const riskLabels: Record<PedagogicalRiskLevel, string> = {
  NORMAL: 'Normal',
  ATTENTION: 'Atenção',
  CRITICAL: 'Crítico',
};

const riskClasses: Record<PedagogicalRiskLevel, string> = {
  NORMAL: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  ATTENTION: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  CRITICAL: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
};

const enrollmentStatusLabels: Record<string, string> = {
  ACTIVE: 'Ativa',
  TRANSFERRED: 'Transferida',
  CANCELLED: 'Cancelada',
  CANCELED: 'Cancelada',
  COMPLETED: 'Concluída',
};

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  const [year, month, day] = value.split('T')[0].split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatOptional(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value !== null && value !== undefined);
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function currentEnrollmentText(
  enrollment: ReturnType<typeof getCurrentEnrollment>,
): string {
  if (!enrollment) return 'Sem matrícula ativa';
  return [
    enrollment.className,
    formatOptional(enrollment.gradeLevel),
    formatOptional(enrollment.shift),
    enrollment.academicYearName,
  ].filter(Boolean).join(' · ');
}

function getCurrentEnrollment(
  record: Awaited<ReturnType<typeof useStudentAcademicRecord>>['data'],
) {
  return record?.student.currentEnrollment ?? null;
}

function subjectStatus(subject: ReportCardSubjectResult): string {
  return subject.isClosed
    ? getResultStatusLabel(subject.resultStatus)
    : 'Pendente';
}

function ResultDetails({ subject }: { subject: ReportCardSubjectResult }) {
  return (
    <details className="mt-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <Eye className="h-4 w-4" aria-hidden="true" />
        Ver avaliações ({subject.assessments.length})
      </summary>
      {subject.assessments.length > 0 ? (
        <div className="mt-3 space-y-2 text-sm">
          {subject.assessments.map((assessment) => (
            <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
              <span className="font-medium text-slate-800 dark:text-slate-200">{assessment.title}</span>
              <span className="text-slate-600 dark:text-slate-400">
                {assessment.score === null ? 'Pendente' : `${formatPercent(assessment.percentage)} · ${assessment.status}`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nenhuma avaliação publicada.</p>
      )}
    </details>
  );
}

export default function StudentAcademicRecordTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const [searchParams, setSearchParams] = useSearchParams();
  const studentId = searchParams.get('student');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const recordQuery = useStudentAcademicRecord(
    institutionQuery.data ?? undefined,
    studentId,
    {
      academicYearId: academicYearId || undefined,
      termId: termId || undefined,
    },
  );
  const record = recordQuery.data;

  const selectedAcademicYearId = academicYearId || record?.selectedAcademicYearId || '';
  const selectedYear = record?.academicYears.find((year) => year.id === selectedAcademicYearId) ?? null;
  const selectedTermId = termId || record?.selectedTermId || '';
  const selectedSubjects = useMemo(() => {
    const subjects = record?.reportCard.subjects ?? [];
    return subjects.filter((subject) =>
      subject.academicYearId === selectedAcademicYearId &&
      subject.termId === selectedTermId,
    );
  }, [record?.reportCard.subjects, selectedAcademicYearId, selectedTermId]);

  function goToModule(moduleId: 'students' | 'academic-documents'): void {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('module', moduleId);
    if (moduleId === 'academic-documents' && studentId) nextParams.set('student', studentId);
    else nextParams.delete('student');
    setSearchParams(nextParams);
  }

  if (!studentId) {
    return (
      <EmptyState
        message="Selecione um aluno para visualizar o prontuário acadêmico."
        onBack={() => goToModule('students')}
      />
    );
  }

  if (recordQuery.isLoading || institutionQuery.isLoading) {
    return <div role="status" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Carregando prontuário acadêmico...</div>;
  }

  if (recordQuery.isError || !record) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => goToModule('students')} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para alunos</button>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">{getUserFacingErrorMessage(recordQuery.error, 'Aluno não encontrado nesta instituição.')}</div>
      </div>
    );
  }

  const { student, monitoring } = record;
  const currentEnrollment = student.currentEnrollment;
  const monitoringSubjects = new Map(
    (monitoring?.subjects ?? []).map((subject) => [subject.subjectOfferingId, subject]),
  );
  const displaySubjects = selectedSubjects.map((subject) => {
    if (subject.isClosed) {
      return subject;
    }

    const monitoringSubject = monitoringSubjects.get(subject.subjectOfferingId);
    return {
      ...subject,
      gradePercentage: monitoringSubject?.gradePercentage ?? subject.gradePercentage,
      attendancePercentage: monitoringSubject?.attendancePercentage ?? subject.attendancePercentage,
    };
  });
  const performance = monitoring?.averageGrade ?? average(
    selectedSubjects.map((subject) => subject.isClosed
      ? subject.finalGradePercentage ?? subject.gradePercentage
      : subject.gradePercentage),
  );
  const frequency = monitoring?.attendancePercentage ?? average(
    selectedSubjects.map((subject) => subject.attendancePercentage),
  );
  const pending = monitoring?.pendingItems ?? selectedSubjects.filter((subject) => !subject.isClosed || subject.resultStatus === 'PENDING').length;
  const risk = monitoring?.risk ?? { level: 'NORMAL' as const, reasons: [] };
  const dataStatus = monitoring?.dataStatus ?? (selectedSubjects.length > 0 && selectedSubjects.every((subject) => subject.isClosed) ? 'OFFICIAL' : 'PARTIAL');
  const socialName = formatOptional(student.details.social_name);
  const address = student.address ? [student.address.street, student.address.number, student.address.neighborhood, student.address.city, student.address.state].filter(Boolean).join(', ') : null;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <button type="button" onClick={() => goToModule('students')} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para alunos</button>
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Aluno 360 · Prontuário acadêmico</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{student.name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">RA {student.registrationNumber}</p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{currentEnrollmentText(currentEnrollment)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={student.active ? 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' : 'rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}>{student.active ? 'Ativo' : 'Inativo'}</span>
            <button type="button" onClick={() => goToModule('academic-documents')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600"><FileText className="h-4 w-4" aria-hidden="true" />Documentos acadêmicos</button>
          </div>
        </div>
      </header>

      <section aria-labelledby="student-record-summary-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="student-record-summary-title" className="text-lg font-bold text-slate-900 dark:text-white">Visão geral</h2><p className="text-sm text-slate-600 dark:text-slate-400">Resumo do desempenho e da frequência no contexto selecionado.</p></div><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{dataStatus === 'OFFICIAL' ? 'Resultado oficial' : 'Dados parciais'}</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Média de desempenho" value={formatPercent(performance)} icon={BookOpen} />
          <Metric label="Frequência média" value={formatPercent(frequency)} icon={CalendarDays} />
          <Metric label="Pendências" value={String(pending)} icon={ClipboardList} />
          <div className={`rounded-xl border p-4 ${riskClasses[risk.level]}`}><p className="text-xs font-bold uppercase tracking-wide">Nível de atenção</p><p className="mt-2 text-xl font-extrabold">{riskLabels[risk.level]}</p></div>
        </div>
        {risk.reasons.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-bold">Motivos do risco</p><ul className="mt-2 list-disc space-y-1 pl-5">{risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="student-record-filters-title">
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="student-record-year" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Ano letivo</label><select id="student-record-year" value={selectedAcademicYearId} onChange={(event) => { setAcademicYearId(event.target.value); setTermId(''); }} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">{record.academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></div><div><label htmlFor="student-record-term" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Período</label><select id="student-record-term" value={selectedTermId} onChange={(event) => setTermId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">{(selectedYear?.terms ?? []).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></div></div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="student-record-results-title">
        <div className="border-b border-slate-200 p-5 dark:border-slate-700"><h2 id="student-record-results-title" className="text-lg font-bold text-slate-900 dark:text-white">Resultados por disciplina</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Resultados fechados permanecem oficiais; períodos abertos são exibidos como parciais.</p></div>
        {displaySubjects.length === 0 ? <p className="p-5 text-sm text-slate-600 dark:text-slate-400">Ainda não há resultados acadêmicos para este aluno.</p> : <div className="divide-y divide-slate-200 dark:divide-slate-800">{displaySubjects.map((subject) => <article key={subject.key} className="p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h3 className="font-bold text-slate-900 dark:text-white">{subject.subjectName}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subject.teacherName} · {subject.termName}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${subject.isClosed ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'}`}>{subject.isClosed ? 'Resultado oficial' : 'Dados parciais'}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getResultBadgeClass(subject.resultStatus)}`}>{subjectStatus(subject)}</span></div></div><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Value label={subject.isClosed ? 'Média original' : 'Média parcial'} value={formatPercent(subject.gradePercentage)} /><Value label={subject.isClosed ? 'Recuperação' : 'Recuperação'} value={subject.isClosed ? formatPercent(subject.recoveryPercentage) : 'Não disponível'} /><Value label={subject.isClosed ? 'Média final' : 'Média final'} value={subject.isClosed ? formatPercent(subject.finalGradePercentage) : 'Não disponível'} /><Value label={subject.isClosed ? 'Frequência' : 'Frequência parcial'} value={formatPercent(subject.attendancePercentage)} /><Value label="Período" value={subject.termName} /></dl><ResultDetails subject={subject} /></article>)}</div>}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="student-record-enrollments-title"><h2 id="student-record-enrollments-title" className="text-lg font-bold text-slate-900 dark:text-white">Matrículas</h2><div className="mt-4 space-y-3">{student.enrollments.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-400">Sem histórico de matrículas.</p> : student.enrollments.map((enrollment) => <div key={enrollment.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900 dark:text-white">{enrollment.academicYearName} · {enrollment.className}</p><span className="text-xs font-bold text-slate-600 dark:text-slate-400">{enrollmentStatusLabels[enrollment.status] ?? enrollment.status}</span></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{[enrollment.gradeLevel, enrollment.shift, enrollment.enrolledAt ? `Matriculado em ${formatDate(enrollment.enrolledAt)}` : null].filter(Boolean).join(' · ') || 'Detalhes não informados'}</p></div>)}</div></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="student-record-registration-title"><h2 id="student-record-registration-title" className="text-lg font-bold text-slate-900 dark:text-white">Cadastro e responsáveis</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><Value label="Nome social" value={socialName ?? 'Não informado'} /><Value label="Nascimento" value={formatDate(student.birthDate)} /><Value label="CPF" value={student.cpf ?? 'Não informado'} /><Value label="E-mail" value={student.email || 'Não informado'} /><Value label="Telefone" value={student.phone ?? 'Não informado'} /><Value label="Endereço" value={address ?? 'Não informado'} /></dl><div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Users className="h-4 w-4" aria-hidden="true" />Responsáveis ativos</h3>{student.guardians.length === 0 ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Nenhum responsável ativo.</p> : <div className="mt-3 space-y-2">{student.guardians.map((guardian) => <div key={guardian.profileId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><p className="font-semibold text-slate-900 dark:text-white">{guardian.name}{guardian.primary ? ' · Principal' : ''}</p><p className="text-sm text-slate-600 dark:text-slate-400">{guardian.relationship} · {guardian.email || guardian.phone || 'Contato não informado'}</p></div>)}</div>}</div><p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Para alterar os dados, use o cadastro do aluno.</p></section>
      </div>
    </div>
  );
}

function EmptyState({ message, onBack }: { message: string; onBack: () => void }) {
  return <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900"><FileText className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><p className="mt-3 font-semibold text-slate-900 dark:text-white">{message}</p><button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para alunos</button></section>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BookOpen }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Icon className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />{label}</div><p className="mt-2 text-xl font-extrabold text-slate-900 dark:text-white">{value}</p></div>;
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</dd></div>;
}

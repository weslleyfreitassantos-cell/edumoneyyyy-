import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FilterX,
  Gauge,
  GraduationCap,
  Users,
} from 'lucide-react';

import { usePedagogicalMonitoring } from '../../hooks/usePedagogicalMonitoring';
import type { PedagogicalRiskLevel } from '../../services/pedagogicalMonitoringService';

const riskLabels: Record<PedagogicalRiskLevel, string> = {
  NORMAL: 'Normal',
  ATTENTION: 'Atenção',
  CRITICAL: 'Crítico',
};

const riskClasses: Record<PedagogicalRiskLevel, string> = {
  NORMAL: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  ATTENTION: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
  CRITICAL: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Não foi possível carregar o acompanhamento pedagógico.';
}

function formatPercentage(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('pt-BR')}%`;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {detail}
          </p>
        </div>
        <span className={`rounded-lg p-2 ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export default function PedagogicalMonitoringPanel({
  institutionId: providedInstitutionId,
}: {
  institutionId?: string;
}) {
  const institutionId = providedInstitutionId;
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherProfileId, setTeacherProfileId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const filters = useMemo(() => ({
    academicYearId: academicYearId || undefined,
    termId: termId || undefined,
    classId: classId || undefined,
    subjectId: subjectId || undefined,
    teacherProfileId: teacherProfileId || undefined,
  }), [academicYearId, classId, subjectId, teacherProfileId, termId]);
  const query = usePedagogicalMonitoring(institutionId, filters);
  const data = query.data;
  const selectedStudent = data?.students.find(
    (student) => student.studentId === selectedStudentId,
  );

  const clearFilters = () => {
    setAcademicYearId('');
    setTermId('');
    setClassId('');
    setSubjectId('');
    setTeacherProfileId('');
    setSelectedStudentId(null);
  };

  return (
    <section className="min-w-0 space-y-5">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
              Acompanhamento pedagógico
            </p>
            <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
              Desempenho e atenção acadêmica
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Uma leitura explicável da frequência, das notas, das pendências e do fechamento do período.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FilterX className="h-4 w-4" aria-hidden="true" />
          Limpar filtros
        </button>
      </header>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Ano letivo
          <select
            aria-label="Ano letivo"
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              setTermId('');
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Atual</option>
            {data?.filters.years.map((year) => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Período
          <select
            aria-label="Período"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Atual</option>
            {data?.filters.terms.map((term) => (
              <option key={term.id} value={term.id}>{term.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Turma
          <select aria-label="Turma" value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">Todas</option>
            {data?.filters.classes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Disciplina
          <select aria-label="Disciplina" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">Todas</option>
            {data?.filters.subjects.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Professor
          <select aria-label="Professor" value={teacherProfileId} onChange={(event) => setTeacherProfileId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">Todos</option>
            {data?.filters.teachers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {query.isLoading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Carregando acompanhamento pedagógico...</div>}
      {query.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{getErrorMessage(query.error)}</div>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Alunos monitorados" value={data.metrics.monitoredStudents} detail={`${data.metrics.officialStudents} oficial(is) · ${data.metrics.partialStudents} parcial(is)`} icon={Users} tone="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" />
            <MetricCard label="Atenção" value={data.metrics.attentionStudents} detail="Sinais que pedem acompanhamento" icon={AlertTriangle} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" />
            <MetricCard label="Baixa frequência" value={data.metrics.lowAttendanceStudents} detail="Abaixo da política da escola" icon={Gauge} tone="bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" />
            <MetricCard label="Baixo desempenho" value={data.metrics.lowPerformanceStudents} detail="Abaixo da política da escola" icon={GraduationCap} tone="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" />
            <MetricCard label="Pendências" value={data.metrics.pendingStudents} detail="Alunos com dados ainda incompletos" icon={AlertTriangle} tone="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" />
            <MetricCard label="Fechamentos" value={`${data.metrics.closedOfferings}/${data.metrics.totalOfferings}`} detail="Atribuições encerradas no período" icon={ClipboardCheck} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Alunos que precisam de acompanhamento</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ordenados por risco e com motivos objetivos para a revisão.</p>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{data.academicYear?.name ?? 'Ano letivo'} · {data.term?.name ?? 'Período'}</span>
              </div>
            </div>
            {data.students.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum aluno matriculado corresponde aos filtros atuais.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
                    <tr><th className="px-4 py-3">Aluno</th><th className="px-4 py-3">Turma</th><th className="px-4 py-3">Média</th><th className="px-4 py-3">Frequência</th><th className="px-4 py-3">Pendências</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3"><span className="sr-only">Detalhes</span></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.students.map((student) => (
                      <tr key={student.studentId} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-4"><p className="font-semibold text-slate-900 dark:text-white">{student.fullName}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">RA {student.registrationNumber}</p></td>
                        <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{student.className}</td>
                        <td className="px-4 py-4 font-semibold text-slate-800 dark:text-slate-200">{formatPercentage(student.averageGrade)}</td>
                        <td className="px-4 py-4 font-semibold text-slate-800 dark:text-slate-200">{formatPercentage(student.attendancePercentage)}</td>
                        <td className="px-4 py-4 text-slate-700 dark:text-slate-300">{student.pendingItems || 'Nenhuma'}</td>
                        <td className="px-4 py-4"><div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${riskClasses[student.risk.level]}`}>{riskLabels[student.risk.level]}</div><p className="mt-2 max-w-[240px] text-xs text-slate-500 dark:text-slate-400">{student.risk.reasons.join(' ') || 'Sem sinais de atenção.'}</p></td>
                        <td className="px-4 py-4 text-right"><button type="button" onClick={() => setSelectedStudentId((current) => current === student.studentId ? null : student.studentId)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-blue-950/40">{selectedStudentId === student.studentId ? 'Fechar' : 'Detalhes'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedStudent && (
            <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalhamento de {selectedStudent.fullName}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Dados {selectedStudent.dataStatus === 'OFFICIAL' ? 'oficiais do fechamento' : 'parciais do período em andamento'}.</p></div><div className={`rounded-full border px-2.5 py-1 text-xs font-bold ${riskClasses[selectedStudent.risk.level]}`}>{riskLabels[selectedStudent.risk.level]}</div></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedStudent.subjects.map((subject) => <article key={subject.subjectOfferingId} className="rounded-lg border border-blue-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-white">{subject.subjectName}</h3><p className="text-xs text-slate-500 dark:text-slate-400">{subject.teacherName}</p></div><span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{subject.isClosed ? 'Oficial' : 'Parcial'}</span></div><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-slate-500 dark:text-slate-400">Nota</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{formatPercentage(subject.gradePercentage)}</dd></div><div><dt className="text-xs text-slate-500 dark:text-slate-400">Frequência</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{formatPercentage(subject.attendancePercentage)}</dd></div></dl>{subject.pendingItems > 0 && <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{subject.pendingItems} avaliação(ões) pendente(s).</p>}</article>)}</div>
            </section>
          )}

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Resumo por turma</h2><div className="mt-4 space-y-3">{data.classes.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma turma encontrada.</p> : data.classes.map((item) => <article key={item.classId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900 dark:text-white">{item.className}</h3><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.students} aluno(s)</span></div><p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{item.critical} crítico(s) · {item.attention} em atenção · {item.normal} normal(is)</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Média {formatPercentage(item.averageGrade)} · Frequência {formatPercentage(item.attendancePercentage)}</p></article>)}</div></section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Pendências e fechamento</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30"><p className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300">Alunos pendentes</p><p className="mt-1 text-xl font-extrabold text-amber-900 dark:text-amber-200">{data.metrics.pendingStudents}</p></div><div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30"><p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">Oficiais</p><p className="mt-1 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">{data.metrics.officialStudents}</p></div><div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30"><p className="text-xs font-bold uppercase text-blue-800 dark:text-blue-300">Parciais</p><p className="mt-1 text-xl font-extrabold text-blue-900 dark:text-blue-200">{data.metrics.partialStudents}</p></div></div><div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300"><p><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" aria-hidden="true" />{data.metrics.closedOfferings} de {data.metrics.totalOfferings} atribuições fechadas.</p><p><GraduationCap className="mr-2 inline h-4 w-4 text-violet-600" aria-hidden="true" />Política: nota mínima {data.policy?.minimumGradePercentage ?? 'não configurada'}% · frequência mínima {data.policy?.minimumAttendancePercentage ?? 'não configurada'}%.</p></div></section>
          </div>
        </>
      )}
    </section>
  );
}

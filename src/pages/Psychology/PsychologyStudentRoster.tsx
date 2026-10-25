import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  psychologyService,
  type PsychologyManagementCandidates,
  type PsychologyProfessionalCandidate,
  type PsychologyStudentCandidate,
} from '../../services/psychologyService';

const PAGE_SIZE = 20;

function authorizationLabel(status: 'ACTIVE' | 'REVOKED' | null): string {
  if (status === 'ACTIVE') return 'Autorização ativa';
  if (status === 'REVOKED') return 'Autorização revogada';
  return 'Autorização pendente';
}

export default function PsychologyStudentRoster({
  institutionId,
  professionals,
  busy,
  refreshKey,
  onProfessionalsLoaded,
  onAssign,
  onUnassign,
}: {
  institutionId: string;
  professionals: PsychologyProfessionalCandidate[];
  busy: boolean;
  refreshKey: number;
  onProfessionalsLoaded: (items: PsychologyProfessionalCandidate[]) => void;
  onAssign: (studentId: string, professionalId: string) => Promise<void>;
  onUnassign: (studentId: string, professionalId: string) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PsychologyManagementCandidates | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfessionals, setSelectedProfessionals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void psychologyService.listManagementCandidates(institutionId, {
      search: debouncedSearch,
      classId,
      gradeLevel,
      assignmentStatus,
      page,
      pageSize: PAGE_SIZE,
    }).then((next) => {
      if (!active) return;
      setResult(next);
      onProfessionalsLoaded(next.professionals);
    }).catch(() => {
      if (active) {
        setResult(null);
        setError(true);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [institutionId, debouncedSearch, classId, gradeLevel, assignmentStatus, page, refreshKey, onProfessionalsLoaded]);

  useEffect(() => {
    if (result && page > result.total_pages) setPage(result.total_pages);
  }, [page, result]);

  const selectedStudent = result?.students.find((student) => student.profile_id === selectedProfileId) ?? null;
  const availableProfessionals = professionals.filter((item) =>
    item.registered && item.verification_status === 'VERIFIED' && item.linked,
  );

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
    setSelectedProfileId(null);
  }

  function selectClass(value: string) {
    setClassId(value);
    setPage(1);
    setSelectedProfileId(null);
  }

  function selectGrade(value: string) {
    setGradeLevel(value);
    setPage(1);
    setSelectedProfileId(null);
  }

  function selectAssignmentStatus(value: 'ALL' | 'ASSIGNED' | 'UNASSIGNED') {
    setAssignmentStatus(value);
    setPage(1);
    setSelectedProfileId(null);
  }

  async function assignRegistration(registrationId: string) {
    const professionalId = selectedProfessionals[registrationId];
    if (!professionalId) return;
    await onAssign(registrationId, professionalId);
  }

  return (
    <section aria-labelledby="psychology-students-title" className="space-y-4">
      <div>
        <h3 id="psychology-students-title" className="font-bold text-slate-900 dark:text-white">Estudantes e vínculos</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pesquise por pessoa ou matrícula. As matrículas permanecem separadas e o acompanhamento é vinculado à matrícula selecionada.</p>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <span className="sr-only">Pesquisar estudante por nome ou matrícula</span>
        <input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Pesquisar por nome ou matrícula" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Turma
          <select value={classId} onChange={(event) => selectClass(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Todas as turmas</option>
            {(result?.filters.classes ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Série
          <select value={gradeLevel} onChange={(event) => selectGrade(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Todas as séries</option>
            {(result?.filters.grades ?? []).map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Acompanhamento
          <select value={assignmentStatus} onChange={(event) => selectAssignmentStatus(event.target.value as typeof assignmentStatus)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">
            <option value="ALL">Todas as situações</option>
            <option value="ASSIGNED">Com profissional vinculada</option>
            <option value="UNASSIGNED">Sem profissional vinculada</option>
          </select>
        </label>
      </div>

      {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Carregando estudantes desta página…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">Não foi possível carregar a lista de estudantes. Tente novamente.</p> : null}
      {!loading && !error && (result?.students.length ?? 0) === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhum estudante corresponde aos filtros.</p> : null}

      {!loading && !error && result && result.students.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[660px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr><th scope="col" className="px-4 py-3">Estudante</th><th scope="col" className="px-4 py-3">Matrículas</th><th scope="col" className="px-4 py-3">Acompanhamento</th><th scope="col" className="px-4 py-3">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {result.students.map((student) => (
                  <tr key={student.profile_id}>
                    <th scope="row" className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{student.full_name}</th>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.registrations.length} {student.registrations.length === 1 ? 'matrícula' : 'matrículas'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{student.registrations.some((registration) => registration.assigned) ? 'Com profissional vinculada' : 'Sem profissional vinculada'}</td>
                    <td className="px-4 py-3"><button type="button" aria-expanded={selectedProfileId === student.profile_id} onClick={() => setSelectedProfileId((current) => current === student.profile_id ? null : student.profile_id)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-950/40">{selectedProfileId === student.profile_id ? 'Ocultar detalhes' : 'Ver / vincular'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <p aria-live="polite">{result.total} pessoas · Página {result.page} de {result.total_pages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => { setSelectedProfileId(null); setPage((current) => Math.max(1, current - 1)); }} aria-label="Página anterior" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
              <button type="button" disabled={page >= result.total_pages || loading} onClick={() => { setSelectedProfileId(null); setPage((current) => Math.min(result.total_pages, current + 1)); }} aria-label="Próxima página" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          </div>

          {selectedStudent ? <StudentDetails
            student={selectedStudent}
            professionals={availableProfessionals}
            selectedProfessionals={selectedProfessionals}
            busy={busy}
            onProfessionalChange={(registrationId, professionalId) => setSelectedProfessionals((current) => ({ ...current, [registrationId]: professionalId }))}
            onAssign={(registrationId) => void assignRegistration(registrationId)}
            onUnassign={(registrationId, professionalId) => void onUnassign(registrationId, professionalId)}
          /> : null}
        </>
      ) : null}
    </section>
  );
}

function StudentDetails({
  student,
  professionals,
  selectedProfessionals,
  busy,
  onProfessionalChange,
  onAssign,
  onUnassign,
}: {
  student: PsychologyStudentCandidate;
  professionals: PsychologyProfessionalCandidate[];
  selectedProfessionals: Record<string, string>;
  busy: boolean;
  onProfessionalChange: (registrationId: string, professionalId: string) => void;
  onAssign: (registrationId: string) => void;
  onUnassign: (registrationId: string, professionalId: string) => void;
}) {
  return (
    <section aria-label={`Detalhes de ${student.full_name}`} className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <h4 className="font-bold text-slate-900 dark:text-white">Matrículas e autorizações de {student.full_name}</h4>
      {student.registrations.map((registration) => (
        <article key={registration.student_id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Matrícula {registration.registration_number ?? 'sem número'}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{registration.enrollments.length ? registration.enrollments.map((enrollment) => `${enrollment.class_name} · ${enrollment.grade_level ?? 'série não informada'} · ${enrollment.academic_year_name}`).join(' | ') : 'Sem turma ativa vinculada'}</p>
            </div>
            <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">{authorizationLabel(registration.authorization_status)}</span>
          </div>
          {registration.assigned_professionals.length ? <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><span>Profissionais:</span>{registration.assigned_professionals.map((professional) => <span key={professional.profile_id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{professional.full_name}<button type="button" disabled={busy} onClick={() => onUnassign(registration.student_id, professional.profile_id)} className="font-semibold text-rose-700 underline disabled:opacity-50 dark:text-rose-300">Encerrar vínculo</button></span>)}</div> : <p className="text-sm text-slate-600 dark:text-slate-300">Sem profissional vinculada.</p>}
          {professionals.length ? <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-56 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Vincular profissional habilitada
              <select value={selectedProfessionals[registration.student_id] ?? ''} onChange={(event) => onProfessionalChange(registration.student_id, event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione</option>{professionals.map((professional) => <option key={professional.profile_id} value={professional.profile_id}>{professional.full_name}</option>)}</select>
            </label>
            <button type="button" disabled={busy || !selectedProfessionals[registration.student_id]} onClick={() => onAssign(registration.student_id)} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Vincular matrícula</button>
          </div> : null}
        </article>
      ))}
    </section>
  );
}

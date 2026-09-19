import {
  useMemo,
  useState,
} from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';

import {
  BadgeCheck,
  BookOpen,
  Mail,
  School,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useGuardianDashboard } from '../hooks/useGuardianDashboard';
import { useAudienceAnnouncements } from '../hooks/useAnnouncements';
import { useGuardianRegistrationCompletion } from '../hooks/useRegistrationCompletion';

import type { GuardianStudentDashboard } from '../services/guardianDashboardService';
import StudentAttendanceSummaryPanel from './attendance/StudentAttendanceSummaryPanel';
import StudentGradesPanel from './grades/StudentGradesPanel';
import AcademicStudentContext from './academic/AcademicStudentContext';
import GuardianReportCard from './academic/GuardianReportCard';
import DashboardAnnouncements from './DashboardAnnouncements';
import UpcomingAcademicEvents from './UpcomingAcademicEvents';

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Não foi possível carregar o painel do responsável.';
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Carregando vínculos familiares"
      className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="space-y-4 motion-safe:animate-pulse motion-reduce:animate-none">
        <div className="h-5 w-44 rounded bg-[#e8edf4] dark:bg-slate-700" />
        <div className="h-4 w-72 max-w-full rounded bg-[#eef1f5] dark:bg-slate-800" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-20 rounded-lg bg-[#f3f5f8] dark:bg-slate-800" />
          <div className="h-20 rounded-lg bg-[#f3f5f8] dark:bg-slate-800" />
          <div className="h-20 rounded-lg bg-[#f3f5f8] dark:bg-slate-800" />
        </div>
        <p className="text-sm font-medium text-[#727785] dark:text-slate-400">
          Carregando vínculos familiares...
        </p>
      </div>
    </div>
  );
}

function StudentSummary({
  item,
}: {
  item: GuardianStudentDashboard;
}) {
  const { student } = item.student;
  const enrollment =
    item.student.activeEnrollment;

  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">
            {item.relationship}
            {item.is_primary ? ' principal' : ''}
          </p>
          <h3 className="mt-1 text-lg font-bold text-[#181c20]">
            {student.profile?.full_name ??
              student.registration_number}
          </h3>
          <p className="mt-1 text-xs text-[#727785]">
            Registro {student.registration_number}
          </p>
        </div>

        <div
          className={
            student.active
              ? 'flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700'
              : 'flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600'
          }
        >
          <BadgeCheck
            className="h-5 w-5"
            aria-hidden="true"
          />
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium text-[#727785]">
            Ano letivo
          </dt>
          <dd className="mt-1 text-sm font-semibold text-[#181c20]">
            {enrollment?.academic_year_name ??
              'Sem matrícula ativa'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-[#727785]">
            Turma
          </dt>
          <dd className="mt-1 text-sm font-semibold text-[#181c20]">
            {enrollment?.class_name ?? '—'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-[#727785]">
            Disciplinas
          </dt>
          <dd className="mt-1 text-sm font-semibold text-[#181c20]">
            {item.student.offerings.length}
          </dd>
        </div>
      </dl>
    </article>
  );
}

type GuardianAcademicSection =
  | 'attendance'
  | 'grades'
  | 'report-card';

function GuardianAcademicResultsView({
  section,
  institutionId,
  students,
  selectedStudent,
  selectedStudentId,
  onSelectStudent,
}: {
  section: GuardianAcademicSection;
  institutionId: string;
  students: GuardianStudentDashboard[];
  selectedStudent: GuardianStudentDashboard | null;
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
}) {
  const selectedStudentRecord = selectedStudent?.student.student;
  const selectedName =
    selectedStudentRecord?.profile?.full_name ??
    selectedStudentRecord?.registration_number ??
    'Dependente';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
      id={`guardian-${section}-main`}
    >
      <AcademicStudentContext
        studentName={selectedName}
        registrationNumber={selectedStudentRecord?.registration_number}
        className={selectedStudent?.student.activeEnrollment?.class_name}
        academicYearName={selectedStudent?.student.activeEnrollment?.academic_year_name}
      >
        <div>
          <label
            htmlFor="guardian-academic-student"
            className="text-xs font-bold uppercase tracking-wide text-[#727785] dark:text-slate-400"
          >
            Dependente
          </label>
          <select
            id="guardian-academic-student"
            value={selectedStudent?.student.student.id ?? selectedStudentId}
            onChange={(event) => onSelectStudent(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-lg border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-[#181c20] outline-none transition-colors focus:border-[#005bbf] focus-visible:ring-2 focus-visible:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus-visible:ring-blue-500/30"
          >
            {students.map((item) => (
              <option key={item.guardianship_id} value={item.student.student.id}>
                {item.student.student.profile?.full_name ?? item.student.student.registration_number}
              </option>
            ))}
          </select>
        </div>
      </AcademicStudentContext>

      {!selectedStudent && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Nenhum aluno ativo está vinculado a este responsável nesta instituição.
        </div>
      )}

      {selectedStudent && section === 'attendance' && (
        <StudentAttendanceSummaryPanel
          institutionId={institutionId}
          studentId={selectedStudent.student.student.id}
          title="Resumo de frequência"
        />
      )}

      {selectedStudent && section === 'grades' && (
        <StudentGradesPanel
          institutionId={institutionId}
          studentId={selectedStudent.student.student.id}
          title="Avaliações publicadas"
        />
      )}

      {selectedStudent && section === 'report-card' && (
        <GuardianReportCard
          institutionId={institutionId}
          studentIds={students.map((item) => item.student.student.id)}
          selectedStudentId={selectedStudent.student.student.id}
          studentName={selectedName}
          className={selectedStudent.student.activeEnrollment?.class_name}
        />
      )}
    </motion.div>
  );
}

export default function ParentDashboard() {
  const { profile } = useAuth();
  const location = useLocation();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const dashboardQuery =
    useGuardianDashboard(
      profile?.id,
      institutionQuery.data,
    );

  const announcementsQuery = useAudienceAnnouncements(
    institutionQuery.data,
    'GUARDIANS',
  );

  const registrationQuery = useGuardianRegistrationCompletion(
    profile?.id,
  );

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState(() =>
    new URLSearchParams(location.search).get('student') ?? '',
  );

  const students =
    dashboardQuery.data?.students ?? [];

  const selectedStudent = useMemo(() => {
    if (students.length === 0) {
      return null;
    }

    return (
      students.find(
        (item) =>
          item.student.student.id ===
          selectedStudentId,
      ) ??
      students.find((item) => item.is_primary) ??
      students[0]
    );
  }, [selectedStudentId, students]);

  if (
    institutionQuery.isLoading ||
    dashboardQuery.isLoading
  ) {
    return <LoadingState />;
  }

  if (
    !profile ||
    institutionQuery.isError ||
    dashboardQuery.isError
  ) {
    const error =
      institutionQuery.error ??
      dashboardQuery.error;

    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
      >
        <h2 className="font-bold">
          Não foi possível carregar o painel
        </h2>
        <p className="mt-2">
          {getErrorMessage(error)}
        </p>
      </div>
    );
  }

  if (
    location.pathname === '/guardian/attendance' ||
    location.pathname === '/guardian/grades' ||
    location.pathname === '/guardian/report-card'
  ) {
    const section = location.pathname.split('/').at(-1) as GuardianAcademicSection;

    return (
      <GuardianAcademicResultsView
        section={section}
        institutionId={institutionQuery.data}
        students={students}
        selectedStudent={selectedStudent}
        selectedStudentId={selectedStudentId}
        onSelectStudent={setSelectedStudentId}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="parent-dashboard-main"
    >
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#005bbf] to-[#1a73e8] p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              Área do responsável
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {profile.full_name}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">
              Alunos vinculados e situação acadêmica carregados diretamente do cadastro da instituição.
            </p>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <UsersRound
              className="h-8 w-8"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <DashboardAnnouncements
        announcements={announcementsQuery.data ?? []}
        registration={registrationQuery.data}
        isLoading={announcementsQuery.isLoading}
        isError={announcementsQuery.isError}
        role="guardian"
      />

      <UpcomingAcademicEvents
        institutionId={institutionQuery.data}
        role="guardian"
      />

      {students.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          Nenhum aluno ativo está vinculado a este responsável nesta instituição.
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {students.map((item) => (
              <button
                key={item.guardianship_id}
                type="button"
                onClick={() =>
                  setSelectedStudentId(
                    item.student.student.id,
                  )
                }
                className={
                  selectedStudent?.guardianship_id ===
                  item.guardianship_id
                    ? 'rounded-xl border-2 border-[#005bbf] text-left shadow-sm'
                    : 'rounded-xl border border-[#dfe3e8] text-left shadow-sm transition-colors hover:border-[#005bbf]'
                }
              >
                <StudentSummary item={item} />
              </button>
            ))}
          </section>

          {selectedStudent && (
            <>
            <section className="grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]">
              <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                  Dados do aluno
                </h2>

                <dl className="mt-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <UserRound
                      className="mt-0.5 h-5 w-5 text-[#727785]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-medium text-[#727785]">
                        Nome
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                        {selectedStudent.student.student.profile
                          ?.full_name ??
                          selectedStudent.student.student
                            .registration_number}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail
                      className="mt-0.5 h-5 w-5 text-[#727785]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-medium text-[#727785]">
                        E-mail
                      </dt>
                      <dd className="mt-1 break-all text-sm font-semibold text-[#181c20]">
                        {selectedStudent.student.student.profile
                          ?.email ?? 'Não informado'}
                      </dd>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <School
                      className="mt-0.5 h-5 w-5 text-[#727785]"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs font-medium text-[#727785]">
                        Turma atual
                      </dt>
                      <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                        {selectedStudent.student.activeEnrollment
                          ?.class_name ??
                          'Sem matrícula ativa'}
                      </dd>
                    </div>
                  </div>
                </dl>
              </article>

              <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
                  Disciplinas e professores
                </h2>

                {selectedStudent.student.offerings.length === 0 ? (
                  <div className="mt-5 rounded-lg border border-dashed border-[#c1c6d6] p-6 text-center text-sm text-[#727785]">
                    Nenhuma disciplina ativa encontrada para a turma atual.
                  </div>
                ) : (
                  <div
                    aria-label="Lista de disciplinas e professores"
                    className="mt-5 max-h-[32rem] space-y-3 overflow-y-auto pr-2"
                  >
                    {selectedStudent.student.offerings.map(
                      (offering) => (
                        <div
                          key={offering.id}
                          className="rounded-lg border border-[#dfe3e8] p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                              <BookOpen
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </div>
                            <div>
                              <p className="font-semibold text-[#181c20]">
                                {offering.subject_name}
                              </p>
                              <p className="mt-1 text-xs text-[#727785]">
                                {offering.teacher_name} • {offering.term_name}
                              </p>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </article>
            </section>

            </>
          )}
        </>
      )}

    </motion.div>
  );
}

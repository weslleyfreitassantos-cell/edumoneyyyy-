import { motion } from 'motion/react';
import { useState } from 'react';

import {
  BadgeCheck,
  BookOpen,
  GraduationCap,
  School,
} from 'lucide-react';

import { useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import {
  useStudentTimetable,
  useTimetableCalendarStatuses,
} from '../hooks/useTimetable';
import { useAudienceAnnouncements } from '../hooks/useAnnouncements';
import { useStudentRegistrationCompletion } from '../hooks/useRegistrationCompletion';
import { normalizeAcademicShift } from '../lib/academic/academicShifts';
import { getLocalDateInputValue } from '../lib/academicTermDates';
import {
  getWeekStartDateKey,
  projectTimetableOccurrences,
} from '../lib/academic/timetableOccurrences';
import { resolveStudentTimetableTerm } from '../lib/academic/studentTimetableTerms';
import { getEnrollmentStatusLabel } from '../lib/statusLabels';
import { getUserFacingErrorMessage } from '../lib/userFacingError';

import type {
  StudentDashboardData,
  StudentDashboardOffering,
} from '../services/studentDashboardService';
import StudentAttendanceSummaryPanel from './attendance/StudentAttendanceSummaryPanel';
import StudentGradesPanel from './grades/StudentGradesPanel';
import AcademicStudentContext from './academic/AcademicStudentContext';
import StudentReportCard from './academic/StudentReportCard';
import ProfileHeroAvatar from './ProfileHeroAvatar';
import DashboardLoadingShell from './DashboardLoadingShell';
import WeeklyTimetableGrid from './academic/WeeklyTimetableGrid';
import DashboardAnnouncements from './DashboardAnnouncements';
import UpcomingAcademicEvents from './UpcomingAcademicEvents';

function getFirstName(
  fullName: string,
): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .at(0) || 'Estudante'
  );
}

function OfferingCard({
  offering,
}: {
  offering: StudentDashboardOffering;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-[#334155] dark:bg-[#18212f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#181c20]">
            {offering.subject_name}
          </h3>
        </div>

        <BookOpen
          className="h-5 w-5 shrink-0 text-[#727785]"
          aria-hidden="true"
        />
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-medium text-[#727785]">
            Docente
          </dt>
          <dd className="mt-1 font-semibold text-[#181c20]">
            {offering.teacher_name}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-medium text-[#727785]">
            Período
          </dt>
          <dd className="mt-1 font-semibold text-[#181c20]">
            {offering.term_name}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function StudentSubjectsView({
  offerings,
}: {
  offerings: StudentDashboardOffering[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="student-subjects-main"
    >
      {offerings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-8 text-center text-sm text-[#727785] dark:border-[#475569] dark:bg-[#18212f]">
          Nenhuma disciplina encontrada para o período atual.
        </div>
      ) : (
        <section aria-labelledby="student-subjects-heading">
          <div className="mb-4">
            <h2
              id="student-subjects-heading"
              className="text-lg font-bold text-[#181c20]"
            >
              {offerings.length}{' '}
              {offerings.length === 1 ? 'disciplina' : 'disciplinas'} no período atual
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {offerings.map((offering) => (
              <div key={offering.id}>
                <OfferingCard offering={offering} />
              </div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}

type StudentAcademicSection =
  | 'attendance'
  | 'grades'
  | 'report-card';

function StudentAcademicResultsView({
  section,
  institutionId,
  student,
  enrollment,
}: {
  section: StudentAcademicSection;
  institutionId: string;
  student: StudentDashboardData['student'];
  enrollment: StudentDashboardData['activeEnrollment'];
}) {
  const studentName =
    student.profile?.full_name?.trim() || 'Estudante sem nome informado';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
      id={`student-${section}-main`}
    >
      <AcademicStudentContext
        studentName={studentName}
        registrationNumber={student.registration_number}
        className={enrollment?.class_name}
        academicYearName={enrollment?.academic_year_name}
      />

      {!enrollment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Nenhuma matrícula ativa encontrada.
        </div>
      )}

      {section === 'attendance' && (
        <StudentAttendanceSummaryPanel
          institutionId={institutionId}
          studentId={student.id}
          title="Resumo de frequência"
        />
      )}

      {section === 'grades' && (
        <StudentGradesPanel
          institutionId={institutionId}
          studentId={student.id}
          title="Avaliações publicadas"
        />
      )}

      {section === 'report-card' && (
        <StudentReportCard
          institutionId={institutionId}
          studentId={student.id}
          studentName={studentName}
          className={enrollment?.class_name}
        />
      )}
    </motion.div>
  );
}

function StudentTimetableView({
  institutionId,
  enrollment,
  academicYearTerms,
  fallbackTerm,
}: {
  institutionId: string;
  enrollment: {
    class_id: string;
    class_name: string;
    shift: string | null;
    academic_year_name: string;
  } | null;
  academicYearTerms: StudentDashboardData['academicYearTerms'];
  fallbackTerm: StudentDashboardOffering | null;
}) {
  const [weekStartDate] = useState(() =>
    getWeekStartDateKey(getLocalDateInputValue()),
  );
  const resolvedTerm = resolveStudentTimetableTerm(
    academicYearTerms.map((term) => ({
      id: term.id,
      startDate: term.start_date,
      endDate: term.end_date,
      active: term.active,
    })),
    weekStartDate,
  );
  const timetableTerm = resolvedTerm ??
    (academicYearTerms.length === 0 && fallbackTerm
      ? {
          id: fallbackTerm.term_id,
          startDate: fallbackTerm.term_start_date,
          endDate: fallbackTerm.term_end_date,
        }
      : null);
  const timetableQuery = useStudentTimetable(
    institutionId,
    enrollment?.class_id,
    timetableTerm?.id ?? (academicYearTerms.length > 0 ? null : undefined),
  );
  const scheduleBreaksQuery = useSchoolScheduleBreaks(institutionId);
  const entries = (timetableQuery.data ?? []).filter(
    (entry) => entry.active,
  );
  const calendarStatusQuery = useTimetableCalendarStatuses(
    institutionId,
    entries,
    weekStartDate,
    timetableTerm?.startDate,
    timetableTerm?.endDate,
  );

  if (!enrollment) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Nenhuma matrícula ativa encontrada para carregar a grade de horário.
      </div>
    );
  }

  if (timetableQuery.isLoading) {
    return (
      <div className="grid min-h-[400px] place-items-center rounded-xl border border-[#dfe3e8] bg-white">
        <div className="text-center">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dfe3e8] border-t-[#005bbf]"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-medium text-[#727785]">
            Carregando grade de horário...
          </p>
        </div>
      </div>
    );
  }

  if (timetableQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        <h2 className="font-bold">Não foi possível carregar a grade de horário</h2>
        <p className="mt-2">{getUserFacingErrorMessage(timetableQuery.error, 'Não foi possível carregar a grade. Tente novamente.')}</p>
        <button type="button" onClick={() => void timetableQuery.refetch()} className="mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
          Tentar novamente
        </button>
      </div>
    );
  }

  const classShift = enrollment.shift?.trim()
    ? normalizeAcademicShift(enrollment.shift)
    : null;
  const scheduleBreaks = scheduleBreaksQuery.data ?? [];
  const occurrences = projectTimetableOccurrences(
    entries,
    weekStartDate,
    calendarStatusQuery.data,
    timetableTerm?.startDate,
    timetableTerm?.endDate,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="student-timetable-main"
    >
      {entries.length === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-8 text-center text-sm text-[#727785]"
        >
          A grade de horário da sua turma ainda não foi publicada.
        </div>
      ) : (
        <>
          {calendarStatusQuery.isError && (
            <p
              role="status"
              className="rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-xs text-[#727785]"
            >
              Não foi possível verificar o calendário. As aulas continuam visíveis.
            </p>
          )}
          <WeeklyTimetableGrid
            entries={entries}
            occurrences={occurrences}
            weekStartDate={weekStartDate}
            scheduleBreaks={scheduleBreaks
              .filter(
                (scheduleBreak) =>
                  classShift !== null &&
                  scheduleBreak.active &&
                  normalizeAcademicShift(scheduleBreak.shift) === classShift,
              )}
            audience="student"
          />
        </>
      )}
    </motion.div>
  );
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const location = useLocation();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const dashboardQuery =
    useStudentDashboard(
      profile?.id,
      institutionQuery.data,
    );

  const announcementsQuery = useAudienceAnnouncements(
    institutionQuery.data,
    'STUDENTS',
  );

  const registrationQuery = useStudentRegistrationCompletion(
    dashboardQuery.data?.student.id,
    institutionQuery.data,
  );

  if (
    institutionQuery.isLoading ||
    dashboardQuery.isLoading
  ) {
    const fullName = profile?.full_name?.trim() || 'Estudante';
    return (
      <DashboardLoadingShell
        areaLabel="Área do estudante"
        heading={`Olá, ${getFirstName(fullName)}!`}
        fullName={fullName}
        avatarUrl={profile?.avatar_url}
        fallback={<GraduationCap className="h-8 w-8" aria-hidden="true" />}
        statusLabel="Carregando dados acadêmicos"
      />
    );
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
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        <h2 className="font-bold">
          Não foi possível carregar o dashboard
        </h2>
        <p className="mt-2">
          {getUserFacingErrorMessage(error, 'Não foi possível carregar os dados acadêmicos. Tente novamente.')}
        </p>
        <button type="button" onClick={() => void Promise.all([institutionQuery.refetch(), dashboardQuery.refetch()])} className="mt-4 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
          Tentar novamente
        </button>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
      >
        O registro acadêmico ainda não está disponível.
      </div>
    );
  }

  const {
    student,
    activeEnrollment,
    offerings,
    academicYearTerms = [],
  } =
    dashboard;

  if (location.pathname === '/dashboard/timetable') {
    return (
      <StudentTimetableView
        institutionId={institutionQuery.data}
        enrollment={activeEnrollment}
        academicYearTerms={academicYearTerms}
        fallbackTerm={offerings.length === 1 ? offerings[0] : null}
      />
    );
  }

  if (location.pathname === '/dashboard/subjects') {
    return (
      <StudentSubjectsView
        offerings={offerings}
      />
    );
  }

  if (
    location.pathname === '/student/attendance' ||
    location.pathname === '/student/grades' ||
    location.pathname === '/student/report-card'
  ) {
    const section = location.pathname.split('/').at(-1) as StudentAcademicSection;

    return (
      <StudentAcademicResultsView
        section={section}
        institutionId={institutionQuery.data}
        student={student}
        enrollment={activeEnrollment}
      />
    );
  }

  const firstName =
    getFirstName(profile.full_name);
  const avatarUrl =
    profile.avatar_url?.trim() || null;

  const classDescription = activeEnrollment
    ? [
        activeEnrollment.grade_level,
        activeEnrollment.shift,
      ]
        .filter(Boolean)
        .join(' • ')
    : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="student-dashboard-main"
    >
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#005bbf] to-[#1a73e8] p-6 text-white shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              Área do estudante
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Olá, {firstName}!
            </h1>
          </div>

          <ProfileHeroAvatar
            avatarUrl={avatarUrl}
            fullName={profile.full_name}
            fallback={
              <GraduationCap
                className="h-8 w-8"
                aria-hidden="true"
              />
            }
          />
        </div>
      </section>

      <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">
              Minha turma
            </p>
            {activeEnrollment ? (
              <>
                <h2 className="mt-1 break-words text-xl font-bold text-[#181c20]">
                  {activeEnrollment.class_name}
                </h2>
                <p className="mt-1 text-sm text-[#727785]">
                  {activeEnrollment.academic_year_name}
                  {classDescription ? ` · ${classDescription}` : ''}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#727785]">
                Nenhuma matrícula ativa encontrada.
              </p>
            )}
          </div>
          {activeEnrollment && (
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              {getEnrollmentStatusLabel(activeEnrollment.status)}
            </span>
          )}
        </div>
      </section>

      <UpcomingAcademicEvents
        institutionId={institutionQuery.data}
        role="student"
      />

      <DashboardAnnouncements
        announcements={announcementsQuery.data ?? []}
        registration={registrationQuery.data}
      isLoading={announcementsQuery.isLoading}
      isError={announcementsQuery.isError}
      role="student"
      onRetry={() => void announcementsQuery.refetch()}
      />

    </motion.div>
  );
}

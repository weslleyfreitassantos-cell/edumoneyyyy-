import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import {
  BadgeCheck,
  BookOpen,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  Mail,
  School,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { useLocation } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useSchoolScheduleBreaks } from '../hooks/useAcademicTermClosing';
import { useStudentDashboard } from '../hooks/useStudentDashboard';
import { useStudentTimetable } from '../hooks/useTimetable';
import { useAudienceAnnouncements } from '../hooks/useAnnouncements';
import { useStudentRegistrationCompletion } from '../hooks/useRegistrationCompletion';
import { normalizeAcademicShift } from '../lib/academic/academicShifts';
import { getEnrollmentStatusLabel } from '../lib/statusLabels';

import type { StudentDashboardOffering } from '../services/studentDashboardService';
import {
  DAYS_OF_WEEK,
  dayLabel,
  type TimetableEntryRow,
} from '../services/timetableService';
import StudentAttendanceSummaryPanel from './attendance/StudentAttendanceSummaryPanel';
import StudentGradesPanel from './grades/StudentGradesPanel';
import StudentReportCard from './academic/StudentReportCard';
import TimetableBreakMarker from './academic/TimetableBreakMarker';
import DashboardAnnouncements from './DashboardAnnouncements';

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

  return 'Não foi possível carregar o dashboard do aluno.';
}

function getFirstName(
  fullName: string,
): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .at(0) || 'Aluno'
  );
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'Não informada';
  }

  const [year, month, day] =
    value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
          {icon}
        </div>

        <div>
          <p className="text-xs font-medium text-[#727785]">
            {label}
          </p>
          <p className="mt-1 text-sm font-bold text-[#181c20]">
            {value}
          </p>
        </div>
      </div>
    </article>
  );
}

function OfferingCard({
  offering,
}: {
  offering: StudentDashboardOffering;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#005bbf]">
            {offering.subject_code ?? 'Disciplina'}
          </p>
          <h3 className="mt-1 text-base font-bold text-[#181c20]">
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
            Professor
          </dt>
          <dd className="mt-1 font-semibold text-[#181c20]">
            {offering.teacher_name}
          </dd>
          <dd className="mt-0.5 break-all text-xs text-[#727785]">
            {offering.teacher_email}
          </dd>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-medium text-[#727785]">
              Período
            </dt>
            <dd className="mt-1 font-semibold text-[#181c20]">
              {offering.term_name}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-[#727785]">
              Carga
            </dt>
            <dd className="mt-1 font-semibold text-[#181c20]">
              {offering.workload
                ? `${offering.workload}h`
                : 'Não informada'}
            </dd>
          </div>
        </div>
      </dl>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[400px] place-items-center rounded-xl border border-[#dfe3e8] bg-white">
      <div className="text-center">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dfe3e8] border-t-[#005bbf]"
          aria-hidden="true"
        />
        <p className="mt-4 text-sm font-medium text-[#727785]">
          Carregando dados acadêmicos...
        </p>
      </div>
    </div>
  );
}

function StudentTimetableView({
  institutionId,
  enrollment,
  currentTermId,
}: {
  institutionId: string;
  enrollment: {
    class_id: string;
    class_name: string;
    shift: string | null;
    academic_year_name: string;
  } | null;
  currentTermId?: string;
}) {
  const timetableQuery = useStudentTimetable(
    institutionId,
    enrollment?.class_id,
    currentTermId,
  );
  const scheduleBreaksQuery = useSchoolScheduleBreaks(institutionId);

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
        <p className="mt-2">{getErrorMessage(timetableQuery.error)}</p>
      </div>
    );
  }

  const entries = (timetableQuery.data ?? []).filter(
    (entry) => entry.active,
  );
  const classShift = enrollment.shift?.trim()
    ? normalizeAcademicShift(enrollment.shift)
    : null;
  const scheduleBreaks = scheduleBreaksQuery.data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      id="student-timetable-main"
    >
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#dfe3e8]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">
              Grade de horário
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#181c20]">
              {enrollment.class_name}
            </h1>
            <p className="mt-2 text-sm text-[#727785]">
              {enrollment.academic_year_name} • horários publicados da sua turma
            </p>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#005bbf]">
            <CalendarClock className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <div
          role="status"
          className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-8 text-center text-sm text-[#727785]"
        >
          A grade de horário da sua turma ainda não foi publicada.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayEntries = entries.filter(
              (entry) => entry.day_of_week === day,
            );
            const dayBreaks = scheduleBreaks.filter(
              (scheduleBreak) =>
                classShift !== null &&
                scheduleBreak.active &&
                scheduleBreak.day_of_week === day &&
                normalizeAcademicShift(scheduleBreak.shift) === classShift,
            );
            const dayItems = [
              ...dayEntries.map((entry) => ({
                kind: 'lesson' as const,
                startTime: entry.start_time,
                entry,
              })),
              ...dayBreaks.map((scheduleBreak) => ({
                kind: 'break' as const,
                startTime: scheduleBreak.start_time,
                scheduleBreak,
              })),
            ].sort((left, right) =>
              left.startTime.localeCompare(right.startTime),
            );

            return (
              <section
                key={day}
                className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-sm"
              >
                <header className="border-b border-[#dfe3e8] bg-[#f8faff] px-4 py-3">
                  <h2 className="text-sm font-bold text-[#181c20]">
                    {dayLabel(day)}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#727785]">
                    {dayEntries.length === 1
                      ? '1 aula'
                      : `${dayEntries.length} aulas`}
                  </p>
                </header>

                {dayItems.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-[#727785]">
                    Sem aulas neste dia.
                  </p>
                ) : (
                  <div className="divide-y divide-[#edf0f5]">
                    {dayItems.map((item) => item.kind === 'break' ? (
                      <div key={`break-${item.scheduleBreak.id}`} className="p-3">
                        <TimetableBreakMarker scheduleBreak={item.scheduleBreak} />
                      </div>
                    ) : (
                      <div key={item.entry.id}>
                        <TimetableEntryCard entry={item.entry} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function TimetableEntryCard({
  entry,
}: {
  entry: TimetableEntryRow;
}) {
  return (
    <article className="flex gap-3 px-4 py-4">
      <div className="w-24 shrink-0 text-xs font-bold text-[#005bbf]">
        <time>{entry.start_time}</time>
        <span className="mx-1 text-[#9aa3b2]">-</span>
        <time>{entry.end_time}</time>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold text-[#181c20]">
          {entry.subject_name || 'Disciplina'}
        </h3>
        <p className="mt-1 truncate text-xs text-[#727785]">
          {entry.teacher_name ?? 'Professor não informado'}
        </p>
        {entry.room_name && (
          <p className="mt-1 truncate text-xs text-[#727785]">
            {entry.room_name}
          </p>
        )}
      </div>
    </article>
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
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        <h2 className="font-bold">
          Não foi possível carregar o dashboard
        </h2>
        <p className="mt-2">
          {getErrorMessage(error)}
        </p>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;

  if (!dashboard) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700"
      >
        O registro acadêmico do aluno ainda não está disponível.
      </div>
    );
  }

  const { student, activeEnrollment, offerings } =
    dashboard;

  if (location.pathname === '/dashboard/timetable') {
    return (
      <StudentTimetableView
        institutionId={institutionQuery.data}
        enrollment={activeEnrollment}
        currentTermId={offerings[0]?.term_id}
      />
    );
  }

  const firstName =
    getFirstName(profile.full_name);

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
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              Área do aluno
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Olá, {firstName}!
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">
              Matrícula, turma e disciplinas carregadas diretamente do cadastro acadêmico.
            </p>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <GraduationCap
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
        role="student"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailCard
          icon={
            <UserRound
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          label="Registro acadêmico"
          value={student.registration_number}
        />

        <DetailCard
          icon={
            <CalendarDays
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          label="Nascimento"
          value={formatDate(student.birth_date)}
        />

        <DetailCard
          icon={
            <School
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          label="Turma atual"
          value={
            activeEnrollment?.class_name ??
            'Sem matrícula ativa'
          }
        />

        <DetailCard
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
          label="Disciplinas do período atual"
          value={offerings.length}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
            Dados da conta
          </h2>

          <dl className="mt-5 space-y-4">
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
                  {profile.email}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <BadgeCheck
                className={
                  student.active
                    ? 'mt-0.5 h-5 w-5 text-green-700'
                    : 'mt-0.5 h-5 w-5 text-gray-500'
                }
                aria-hidden="true"
              />
              <div>
                <dt className="text-xs font-medium text-[#727785]">
                  Situação
                </dt>
                <dd
                  className={
                    student.active
                      ? 'mt-1 text-sm font-semibold text-green-700'
                      : 'mt-1 text-sm font-semibold text-gray-600'
                  }
                >
                  {student.active
                    ? 'Aluno ativo'
                    : 'Aluno inativo'}
                </dd>
              </div>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
            Matrícula ativa
          </h2>

          {activeEnrollment ? (
            <dl className="mt-5 space-y-4">
              <div>
                <dt className="text-xs font-medium text-[#727785]">
                  Ano letivo
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                  {activeEnrollment.academic_year_name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-[#727785]">
                  Turma
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                  {activeEnrollment.class_name}
                </dd>
                {classDescription && (
                  <dd className="mt-0.5 text-xs text-[#727785]">
                    {classDescription}
                  </dd>
                )}
              </div>

              <div>
                <dt className="text-xs font-medium text-[#727785]">
                  Status
                </dt>
                <dd className="mt-1 text-sm font-semibold text-green-700">
                  {getEnrollmentStatusLabel(activeEnrollment.status)}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Nenhuma matrícula ativa encontrada para este aluno.
            </div>
          )}
        </article>
      </section>

      <StudentAttendanceSummaryPanel
        institutionId={institutionQuery.data}
        studentId={student.id}
      />

      <StudentGradesPanel
        institutionId={institutionQuery.data}
        studentId={student.id}
      />

      <StudentReportCard
        institutionId={institutionQuery.data}
        studentId={student.id}
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <UsersRound
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-[#181c20]">
            Disciplinas e professores do período atual
          </h2>
        </div>

        {offerings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-8 text-center text-sm text-[#727785]">
            Nenhuma disciplina encontrada para o período atual.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {offerings.map((offering) => (
              <div key={offering.id}>
                <OfferingCard
                  offering={offering}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}

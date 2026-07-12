import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Mail,
  School,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import { useCurrentInstitution } from '../hooks/useCurrentInstitution';
import { useStudentDashboard } from '../hooks/useStudentDashboard';

import type { StudentDashboardOffering } from '../services/studentDashboardService';
import StudentAttendanceSummaryPanel from './attendance/StudentAttendanceSummaryPanel';
import StudentGradesPanel from './grades/StudentGradesPanel';
import StudentReportCard from './academic/StudentReportCard';

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

export default function StudentDashboard() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const dashboardQuery =
    useStudentDashboard(
      profile?.id,
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
          label="Disciplinas ativas"
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
                  {activeEnrollment.status}
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
            Disciplinas e professores
          </h2>
        </div>

        {offerings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-8 text-center text-sm text-[#727785]">
            Nenhuma disciplina ativa encontrada para a turma atual.
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

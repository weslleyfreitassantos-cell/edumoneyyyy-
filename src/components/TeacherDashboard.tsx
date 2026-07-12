import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import {
  BookOpen,
  GraduationCap,
  Layers3,
  School,
  Users,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import { useCurrentInstitution } from '../hooks/useCurrentInstitution';

import { useTeacherDashboard } from '../hooks/useTeacherDashboard';

import type { TeacherOffering } from '../services/teacherDashboardService';
import TeacherAttendancePanel from './attendance/TeacherAttendancePanel';

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

  return 'Não foi possível carregar o dashboard do professor.';
}

function getFirstName(
  fullName: string,
): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .at(0) ||
    'Professor'
  );
}

function getClassDescription(
  offering: TeacherOffering,
): string {
  return [
    offering.gradeLevel,
    offering.shift,
  ]
    .filter(Boolean)
    .join(' • ');
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#727785]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#181c20]">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
          {icon}
        </div>
      </div>
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
          Carregando atribuições acadêmicas...
        </p>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const dashboardQuery =
    useTeacherDashboard(
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

  const dashboard =
    dashboardQuery.data;

  if (!dashboard) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        Os dados acadêmicos do professor ainda não estão disponíveis.
      </div>
    );
  }

  const firstName =
    getFirstName(profile.full_name);

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      className="space-y-6"
      id="teacher-dashboard-main"
    >
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#005bbf] to-[#1a73e8] p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
              Área do professor
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Olá, {firstName}!
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">
              Suas turmas e disciplinas abaixo foram carregadas diretamente das ofertas acadêmicas.
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
        <MetricCard
          label="Ofertas ativas"
          value={dashboard.totals.offerings}
          icon={
            <BookOpen
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Turmas"
          value={dashboard.totals.classes}
          icon={
            <School
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Disciplinas"
          value={dashboard.totals.subjects}
          icon={
            <Layers3
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <MetricCard
          label="Alunos vinculados"
          value={
            dashboard.totals.students ??
            '—'
          }
          icon={
            <Users
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />
      </section>

      {!dashboard.enrollmentAccessAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          As ofertas foram carregadas, mas a quantidade de alunos não pôde ser consultada com as permissões atuais.
        </div>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#181c20]">
            Minhas atribuições
          </h2>

          <p className="mt-1 text-sm text-[#727785]">
            Disciplinas e turmas vinculadas ao seu perfil.
          </p>
        </div>

        {dashboard.offerings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-10 text-center">
            <School
              className="mx-auto h-10 w-10 text-[#727785]"
              aria-hidden="true"
            />

            <h3 className="mt-4 text-sm font-bold text-[#181c20]">
              Nenhuma atribuição encontrada
            </h3>

            <p className="mt-2 text-xs text-[#727785]">
              Um administrador ou diretor precisa vincular este professor a uma oferta de disciplina.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.offerings.map(
              (offering) => {
                const classDescription =
                  getClassDescription(
                    offering,
                  );

                return (
                  <motion.article
                    key={offering.id}
                    whileHover={{
                      y: -3,
                    }}
                    className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-sm"
                  >
                    <div className="h-1.5 bg-[#005bbf]" />

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#005bbf]">
                            {offering.subjectCode ??
                              'Disciplina'}
                          </p>

                          <h3 className="mt-1 text-base font-bold text-[#181c20]">
                            {offering.subjectName}
                          </h3>
                        </div>

                        <BookOpen
                          className="h-5 w-5 shrink-0 text-[#727785]"
                          aria-hidden="true"
                        />
                      </div>

                      <dl className="mt-5 space-y-3">
                        <div>
                          <dt className="text-[10px] font-bold uppercase tracking-wide text-[#727785]">
                            Turma
                          </dt>

                          <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                            {offering.className}
                          </dd>

                          {classDescription && (
                            <dd className="mt-0.5 text-xs text-[#727785]">
                              {classDescription}
                            </dd>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-[#727785]">
                              Alunos
                            </dt>

                            <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                              {offering.studentCount ??
                                '—'}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-[10px] font-bold uppercase tracking-wide text-[#727785]">
                              Carga horária
                            </dt>

                            <dd className="mt-1 text-sm font-semibold text-[#181c20]">
                              {offering.workload
                                ? `${offering.workload}h`
                                : 'Não informada'}
                            </dd>
                          </div>
                        </div>
                      </dl>
                    </div>
                  </motion.article>
                );
              },
            )}
          </div>
        )}
      </section>

      <TeacherAttendancePanel
        profileId={profile.id}
        institutionId={institutionQuery.data}
      />
    </motion.div>
  );
}

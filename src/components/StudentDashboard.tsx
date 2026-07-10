import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Clock3,
  GraduationCap,
  Mail,
  School,
  UserRound,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

import { useCurrentInstitution } from '../hooks/useCurrentInstitution';

import { useStudentDashboard } from '../hooks/useStudentDashboard';

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

function shortenInstitutionId(
  institutionId: string,
): string {
  if (institutionId.length <= 16) {
    return institutionId;
  }

  return `${institutionId.slice(0, 8)}…${institutionId.slice(-4)}`;
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

function UnavailableModule({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#005bbf]/10 text-[#005bbf]">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#181c20]">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-relaxed text-[#727785]">
        {description}
      </p>

      <span className="mt-4 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        Em preparação
      </span>
    </div>
  );
}

export default function StudentDashboard() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const studentQuery =
    useStudentDashboard(
      profile?.id,
      institutionQuery.data,
    );

  if (
    institutionQuery.isLoading ||
    studentQuery.isLoading
  ) {
    return <LoadingState />;
  }

  if (
    !profile ||
    institutionQuery.isError ||
    studentQuery.isError
  ) {
    const error =
      institutionQuery.error ??
      studentQuery.error;

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

  const student = studentQuery.data;

  if (!student) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700"
      >
        O registro acadêmico do aluno ainda não está disponível.
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
              Seus dados pessoais e acadêmicos já estão conectados ao sistema.
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

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#181c20]">
            Identificação acadêmica
          </h2>

          <p className="mt-1 text-sm text-[#727785]">
            Informações carregadas diretamente do banco de dados.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                <UserRound
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-[#727785]">
                  Nome completo
                </p>

                <p className="mt-1 text-sm font-bold text-[#181c20]">
                  {profile.full_name}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                <GraduationCap
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-[#727785]">
                  Registro acadêmico
                </p>

                <p className="mt-1 text-sm font-bold text-[#181c20]">
                  {student.registration_number}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                <CalendarDays
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-[#727785]">
                  Data de nascimento
                </p>

                <p className="mt-1 text-sm font-bold text-[#181c20]">
                  {formatDate(
                    student.birth_date,
                  )}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
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

              <div>
                <p className="text-xs font-medium text-[#727785]">
                  Situação
                </p>

                <p
                  className={
                    student.active
                      ? 'mt-1 text-sm font-bold text-green-700'
                      : 'mt-1 text-sm font-bold text-gray-600'
                  }
                >
                  {student.active
                    ? 'Aluno ativo'
                    : 'Aluno inativo'}
                </p>
              </div>
            </div>
          </article>
        </div>
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
              <School
                className="mt-0.5 h-5 w-5 text-[#727785]"
                aria-hidden="true"
              />

              <div>
                <dt className="text-xs font-medium text-[#727785]">
                  Instituição vinculada
                </dt>

                <dd
                  className="mt-1 text-sm font-semibold text-[#181c20]"
                  title={student.institution_id}
                >
                  {shortenInstitutionId(
                    student.institution_id,
                  )}
                </dd>
              </div>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-[#dfe3e8] bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#005bbf]">
            Situação acadêmica
          </h2>

          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <BadgeCheck
                className="mt-0.5 h-5 w-5 text-green-700"
                aria-hidden="true"
              />

              <div>
                <p className="text-sm font-bold text-green-800">
                  Cadastro conectado
                </p>

                <p className="mt-1 text-xs leading-relaxed text-green-700">
                  Seu perfil, vínculo institucional e registro acadêmico foram encontrados.
                </p>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#181c20]">
            Recursos acadêmicos
          </h2>

          <p className="mt-1 text-sm text-[#727785]">
            Estes módulos serão ativados quando as tabelas correspondentes forem implementadas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <UnavailableModule
            icon={
              <Clock3
                className="h-5 w-5"
                aria-hidden="true"
              />
            }
            title="Horários e disciplinas"
            description="Os horários serão exibidos quando as ofertas de disciplinas e matrículas estiverem conectadas."
          />

          <UnavailableModule
            icon={
              <ClipboardList
                className="h-5 w-5"
                aria-hidden="true"
              />
            }
            title="Notas e avaliações"
            description="As notas aparecerão após a criação das tabelas de avaliações e lançamentos."
          />

          <UnavailableModule
            icon={
              <BookOpen
                className="h-5 w-5"
                aria-hidden="true"
              />
            }
            title="Frequência"
            description="A frequência será calculada após a implementação das chamadas e registros de presença."
          />
        </div>
      </section>
    </motion.div>
  );
}
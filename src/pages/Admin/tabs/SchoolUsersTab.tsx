import { useMemo, useState } from 'react';

import {
  PlusCircle,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';

import type { CurrentDatabaseRole } from '../../../lib/permissions';

import type { SchoolUserRow } from '../../../services/schoolUserService';

type RoleFilter =
  | 'ALL'
  | CurrentDatabaseRole;

const roleLabels: Record<
  CurrentDatabaseRole,
  string
> = {
  ADMIN: 'Administração',
  DIRECTOR: 'Direção',
  TEACHER: 'Professor',
  STUDENT: 'Aluno',
  GUARDIAN: 'Responsável',
};

const filterOptions: {
  value: RoleFilter;
  label: string;
}[] = [
  { value: 'ALL', label: 'Todos' },
  {
    value: 'ADMIN',
    label: 'Administração',
  },
  { value: 'DIRECTOR', label: 'Direção' },
  {
    value: 'TEACHER',
    label: 'Professores',
  },
  { value: 'STUDENT', label: 'Alunos' },
  {
    value: 'GUARDIAN',
    label: 'Responsáveis',
  },
];

const plannedRoles = [
  {
    role: 'SUPER_ADMIN',
    description:
      'Em breve, papel de plataforma',
    icon: ShieldCheck,
  },
  {
    role: 'SCHOOL_ADMIN',
    description:
      'Em breve, administração interna da escola',
    icon: UserCog,
  },
  {
    role: 'SECRETARY',
    description:
      'Em breve, secretaria escolar',
    icon: Users,
  },
] as const;

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

  return 'Não foi possível carregar os usuários da escola.';
}

function formatDate(
  value: string | undefined,
): string {
  if (!value) {
    return 'Não informado';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
    },
  ).format(date);
}

function StatusBadge({
  active,
}: {
  active: boolean | null;
}) {
  if (active === null) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
        Não informado
      </span>
    );
  }

  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700'
          : 'inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600'
      }
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function SchoolUsersTable({
  users,
}: {
  users: SchoolUserRow[];
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-8 text-center text-sm text-gray-500">
        Nenhum usuário encontrado para o filtro selecionado.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Nome
              </th>

              <th className="px-4 py-3 text-left font-medium text-gray-700">
                E-mail
              </th>

              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Papel atual
              </th>

              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Vínculo
              </th>

              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Entrada
              </th>

              <th className="px-4 py-3 text-left font-medium text-gray-700">
                Perfil
              </th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-t transition-colors hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-[#181c20]">
                  {user.profile?.full_name ??
                    'Perfil indisponível'}
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {user.profile?.email ??
                    'Não informado'}
                </td>

                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#005bbf]">
                    {roleLabels[user.role]}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <StatusBadge
                    active={user.active}
                  />
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {formatDate(user.joined_at)}
                </td>

                <td className="px-4 py-3">
                  <StatusBadge
                    active={
                      user.profile?.active ?? null
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SchoolUsersTab() {
  const { profile } = useAuth();

  const institutionQuery =
    useCurrentInstitution(profile?.id);

  const institutionId =
    institutionQuery.data ?? '';

  const usersQuery =
    useSchoolUsers(institutionId);

  const [selectedRole, setSelectedRole] =
    useState<RoleFilter>('ALL');

  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];

    if (selectedRole === 'ALL') {
      return users;
    }

    return users.filter(
      (user) => user.role === selectedRole,
    );
  }, [selectedRole, usersQuery.data]);

  if (institutionQuery.isLoading) {
    return (
      <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
        Carregando instituição...
      </div>
    );
  }

  if (institutionQuery.isError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        {getErrorMessage(
          institutionQuery.error,
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#181c20]">
              Usuários da Escola
            </h3>

            <p className="mt-1 text-sm text-[#727785]">
              Vínculos atuais da instituição com base em memberships e profiles.
            </p>
          </div>

          <div className="lg:max-w-sm lg:text-right">
            <button
              type="button"
              disabled
              title="O cadastro unificado de usuários será habilitado após a reconciliação das migrations, criação dos novos papéis e homologação do fluxo de convite/senha."
              aria-describedby="new-user-disabled-help"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500"
            >
              <PlusCircle
                className="h-4 w-4"
                aria-hidden="true"
              />
              Novo usuário
            </button>

            <p
              id="new-user-disabled-help"
              className="mt-2 text-xs leading-relaxed text-[#727785]"
            >
              O cadastro unificado de usuários será habilitado após a reconciliação das migrations, criação dos novos papéis e homologação do fluxo de convite/senha.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                setSelectedRole(option.value)
              }
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selectedRole === option.value
                  ? 'border-[#005bbf] bg-blue-50 text-[#005bbf]'
                  : 'border-[#dfe3e8] bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {usersQuery.isLoading ? (
          <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-gray-500">
            Carregando usuários...
          </div>
        ) : usersQuery.isError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
          >
            {getErrorMessage(
              usersQuery.error,
            )}
          </div>
        ) : (
          <SchoolUsersTable
            users={filteredUsers}
          />
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-[#181c20]">
          Papéis planejados
        </h3>

        <div className="grid gap-3 md:grid-cols-3">
          {plannedRoles.map((plannedRole) => {
            const Icon = plannedRole.icon;

            return (
              <article
                key={plannedRole.role}
                className="rounded-xl border border-dashed border-[#dfe3e8] bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <Icon
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <h4 className="text-sm font-bold text-[#181c20]">
                      {plannedRole.role}
                    </h4>

                    <p className="mt-1 text-xs leading-relaxed text-[#727785]">
                      {plannedRole.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

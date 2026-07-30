import {
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  PlusCircle,
  Search,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';

import {
  CURRENT_DATABASE_ROLES,
  hasEffectivePermission,
  type CurrentDatabaseRole,
} from '../../../lib/permissions';

import type { SchoolUserRow } from '../../../services/schoolUserService';
import UnifiedUserInvitePreview from './school-users/UnifiedUserInvitePreview';

type RoleFilter =
  | 'ALL'
  | CurrentDatabaseRole;

export const schoolUserRoleLabels: Record<
  CurrentDatabaseRole,
  string
> = {
  ADMIN: 'Administração',
  DIRECTOR: 'Direção',
  SECRETARY: 'Secretaria',
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
  { value: 'SECRETARY', label: 'Secretaria' },
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

export interface SchoolUserSummary {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<CurrentDatabaseRole, number>;
}

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

function normalizeSearchValue(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
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

export function filterSchoolUsers(
  users: SchoolUserRow[],
  selectedRole: RoleFilter,
  searchTerm: string,
): SchoolUserRow[] {
  const normalizedTerm =
    normalizeSearchValue(searchTerm);

  return users.filter((user) => {
    const matchesRole =
      selectedRole === 'ALL' ||
      user.role === selectedRole;

    if (!matchesRole) {
      return false;
    }

    if (!normalizedTerm) {
      return true;
    }

    const searchableText = [
      user.profile?.full_name ?? '',
      user.profile?.email ?? '',
      user.role,
      schoolUserRoleLabels[user.role],
    ]
      .map(normalizeSearchValue)
      .join(' ');

    return searchableText.includes(
      normalizedTerm,
    );
  });
}

export function getSchoolUserSummary(
  users: SchoolUserRow[],
): SchoolUserSummary {
  const byRole = Object.fromEntries(
    CURRENT_DATABASE_ROLES.map((role) => [
      role,
      0,
    ]),
  ) as Record<CurrentDatabaseRole, number>;

  for (const user of users) {
    byRole[user.role] += 1;
  }

  const active = users.filter(
    (user) => user.active,
  ).length;

  return {
    total: users.length,
    active,
    inactive: users.length - active,
    byRole,
  };
}

function StatusBadge({
  active,
}: {
  active: boolean | null;
}) {
  if (active === null) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
        Status não informado
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

function SummaryCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'muted';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-green-50 text-green-700'
      : tone === 'muted'
        ? 'bg-gray-100 text-gray-600'
        : 'bg-blue-50 text-[#005bbf]';

  return (
    <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#727785]">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold text-[#181c20]">
            {value}
          </p>
        </div>

        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneClass}`}
        >
          {icon}
        </span>
      </div>
    </article>
  );
}

function SchoolUsersTable({
  users,
}: {
  users: SchoolUserRow[];
}) {
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
                    {
                      schoolUserRoleLabels[
                        user.role
                      ]
                    }
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

function EmptyState({
  hasUsers,
  hasInstitution,
}: {
  hasUsers: boolean;
  hasInstitution: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#dfe3e8] bg-white p-8 text-center">
      <h3 className="text-base font-bold text-[#181c20]">
        {!hasInstitution
          ? 'Nenhuma escola ativa selecionada'
          : hasUsers
          ? 'Nenhum resultado encontrado'
          : 'Nenhum usuário vinculado'}
      </h3>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#727785]">
        {!hasInstitution
          ? 'Selecione uma escola ativa para visualizar os usuários vinculados a ela.'
          : hasUsers
          ? 'Ajuste a busca ou os filtros para localizar usuários por nome, e-mail ou papel.'
          : 'Quando houver vínculos ativos ou inativos em memberships para esta instituição, eles aparecerão nesta tela somente leitura.'}
      </p>
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

  const [searchTerm, setSearchTerm] =
    useState('');

  const users = usersQuery.data ?? [];

  const summary = useMemo(
    () => getSchoolUserSummary(users),
    [users],
  );

  const filteredUsers = useMemo(
    () =>
      filterSchoolUsers(
        users,
        selectedRole,
        searchTerm,
      ),
    [searchTerm, selectedRole, users],
  );

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

      <UnifiedUserInvitePreview
        institutionId={institutionId}
        currentRole={
          institutionQuery.currentRole
        }
        profileRole={profile?.role}
        currentInstitutionName={
          institutionQuery.currentInstitution
            ?.name ?? null
        }
        hasActiveInstitution={Boolean(
          institutionId,
        )}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Usuários vinculados"
          value={summary.total}
          icon={
            <Users
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <SummaryCard
          label="Vínculos ativos"
          value={summary.active}
          tone="success"
          icon={
            <UserRoundCheck
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <SummaryCard
          label="Vínculos inativos"
          value={summary.inactive}
          tone="muted"
          icon={
            <UserRoundX
              className="h-5 w-5"
              aria-hidden="true"
            />
          }
        />

        <article className="rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#727785]">
            Total por papel
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {CURRENT_DATABASE_ROLES.map(
              (role) => (
                <div
                  key={role}
                  className="flex items-center justify-between gap-2"
                >
                  <dt className="truncate text-[#727785]">
                    {schoolUserRoleLabels[role]}
                  </dt>
                  <dd className="font-bold text-[#181c20]">
                    {summary.byRole[role]}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </article>
      </section>

      <section className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_auto] lg:items-end">
          <div>
            <label
              htmlFor="school-users-search"
              className="block text-sm font-medium text-[#414754]"
            >
              Buscar usuário
            </label>

            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />

              <input
                id="school-users-search"
                type="search"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value,
                  )
                }
                placeholder="Nome, e-mail ou papel"
                className="w-full rounded-lg border border-[#dfe3e8] bg-white py-2 pl-9 pr-3 text-sm text-[#181c20] outline-none transition-colors placeholder:text-gray-400 focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div
            className="flex flex-wrap gap-2"
            aria-label="Filtrar usuários por papel"
          >
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={
                  selectedRole === option.value
                }
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
        ) : !institutionId ? (
          <EmptyState
            hasUsers={false}
            hasInstitution={false}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            hasUsers={users.length > 0}
            hasInstitution
          />
        ) : (
          <SchoolUsersTable
            users={filteredUsers}
          />
        )}
      </section>
    </div>
  );
}

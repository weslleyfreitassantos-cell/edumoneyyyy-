import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';

import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';

import { useSchoolUsers } from '../../../hooks/useSchoolUsers';
import { useManageSchoolUser } from '../../../hooks/useSchoolUserManagement';

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

type EditableSchoolRole = CurrentDatabaseRole;

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

const editableRoleOptions: {
  value: EditableSchoolRole;
  label: string;
}[] = [
  { value: 'ADMIN', label: 'Administração' },
  { value: 'DIRECTOR', label: 'Direção' },
  { value: 'SECRETARY', label: 'Secretaria' },
  { value: 'TEACHER', label: 'Professor' },
  { value: 'STUDENT', label: 'Aluno' },
  { value: 'GUARDIAN', label: 'Responsável' },
];

const SCHOOL_USERS_PAGE_SIZE = 10;

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

function normalizeCpfValue(
  value: string,
): string {
  return value.replace(/\D/g, '');
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

    const normalizedCpf = normalizeCpfValue(
      user.cpf ?? '',
    );
    const normalizedTermDigits = normalizeCpfValue(
      searchTerm,
    );

    return (
      searchableText.includes(normalizedTerm) ||
      (normalizedTermDigits.length > 0 &&
        normalizedCpf.includes(normalizedTermDigits))
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
  onEdit,
  onDelete,
  isBusy,
}: {
  users: SchoolUserRow[];
  onEdit: (user: SchoolUserRow) => void;
  onDelete: (user: SchoolUserRow) => void;
  isBusy: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow">
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_#dfe3e8]">
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

              <th className="px-4 py-3 text-right font-medium text-gray-700">
                Acoes
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

                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      title="Editar usuario"
                      aria-label={`Editar ${
                        user.profile?.full_name ??
                        'usuario'
                      }`}
                      disabled={isBusy}
                      onClick={() => onEdit(user)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Edit3
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      title="Excluir usuario"
                      aria-label={`Excluir ${
                        user.profile?.full_name ??
                        'usuario'
                      }`}
                      disabled={isBusy}
                      onClick={() => onDelete(user)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SchoolUserEditDialog({
  user,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  user: SchoolUserRow;
  onClose: () => void;
  onSubmit: (input: {
    fullName: string;
    role: EditableSchoolRole;
    password: string;
  }) => void;
  isSubmitting: boolean;
}) {
  const [fullName, setFullName] = useState(
    user.profile?.full_name ?? '',
  );
  const [role, setRole] = useState<EditableSchoolRole>(user.role);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmedPassword = password.trim();
    if (trimmedPassword.length > 0 && trimmedPassword.length < 8) {
      setPasswordError('A nova senha deve conter pelo menos 8 caracteres.');
      return;
    }

    setPasswordError(null);
    onSubmit({
      fullName,
      role,
      password: trimmedPassword,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-user-edit-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              id="school-user-edit-title"
              className="text-lg font-bold text-[#181c20] dark:text-white"
            >
              Editar usuario
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Atualize dados de acesso sem depender do e-mail de convite.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="school-user-full-name"
              className="text-sm font-semibold text-gray-700 dark:text-slate-200"
            >
              Nome completo
            </label>
            <input
              id="school-user-full-name"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="school-user-role"
              className="text-sm font-semibold text-gray-700 dark:text-slate-200"
            >
              Papel
            </label>
            <select
              id="school-user-role"
              value={role}
              onChange={(event) =>
                setRole(
                  event.target
                    .value as EditableSchoolRole,
                )
              }
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {editableRoleOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="school-user-password"
              className="text-sm font-semibold text-gray-700 dark:text-slate-200"
            >
              Nova senha
            </label>
            <input
              id="school-user-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Deixe vazio para nao alterar"
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {passwordError ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                {passwordError}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Minimo de 8 caracteres.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Salvar
          </button>
        </div>
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
          ? 'Ajuste a busca ou os filtros para localizar usuários por nome, e-mail, CPF ou papel.'
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
  const manageUserMutation =
    useManageSchoolUser();

  const [selectedRole, setSelectedRole] =
    useState<RoleFilter>('ALL');

  const [searchTerm, setSearchTerm] =
    useState('');
  const [currentPage, setCurrentPage] =
    useState(1);
  const [editingUser, setEditingUser] =
    useState<SchoolUserRow | null>(null);
  const [feedback, setFeedback] =
    useState<{
      type: 'success' | 'error';
      message: string;
    } | null>(null);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [feedback]);

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

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredUsers.length /
        SCHOOL_USERS_PAGE_SIZE,
    ),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRole]);

  useEffect(() => {
    setCurrentPage((page) =>
      Math.min(page, totalPages),
    );
  }, [totalPages]);

  const pageStart =
    (currentPage - 1) *
    SCHOOL_USERS_PAGE_SIZE;
  const paginatedUsers = filteredUsers.slice(
    pageStart,
    pageStart + SCHOOL_USERS_PAGE_SIZE,
  );

  const isManaging =
    manageUserMutation.isPending;

  function handleEditSubmit(input: {
    fullName: string;
    role: EditableSchoolRole;
    password: string;
  }) {
    if (!editingUser || !institutionId) {
      return;
    }

    const fullName = input.fullName.trim();
    const password = input.password.trim();
    const originalName = editingUser.profile?.full_name ?? '';

    const hasNameChanged = fullName !== '' && fullName !== originalName;
    const hasRoleChanged = input.role !== editingUser.role;
    const hasPassword = Boolean(password);

    if (!hasNameChanged && !hasRoleChanged && !hasPassword) {
      setFeedback({
        type: 'error',
        message: 'Nenhum dado foi alterado.',
      });
      setEditingUser(null);
      return;
    }

    manageUserMutation.mutate(
      {
        action: 'update',
        institutionId,
        membershipId: editingUser.id,
        ...(hasNameChanged ? { fullName } : {}),
        ...(hasRoleChanged ? { role: input.role } : {}),
        ...(hasPassword ? { password } : {}),
      },
      {
        onSuccess: (result) => {
          setFeedback({
            type: 'success',
            message: result.message,
          });
          setEditingUser(null);
        },
        onError: (error) => {
          setFeedback({
            type: 'error',
            message: getErrorMessage(error),
          });
        },
      },
    );
  }

  function handleDeleteUser(user: SchoolUserRow) {
    if (!institutionId || isManaging) {
      return;
    }

    const name =
      user.profile?.full_name ??
      user.profile?.email ??
      'este usuario';

    const confirmed = window.confirm(
      `Excluir ${name}? Esta acao remove o vinculo da escola e pode remover o acesso do usuario se ele nao tiver outros vinculos.`,
    );

    if (!confirmed) {
      return;
    }

    manageUserMutation.mutate(
      {
        action: 'delete',
        institutionId,
        membershipId: user.id,
        confirmation: 'EXCLUIR USUARIO',
      },
      {
        onSuccess: (result) => {
          setFeedback({
            type: 'success',
            message: result.message,
          });
        },
        onError: (error) => {
          setFeedback({
            type: 'error',
            message: getErrorMessage(error),
          });
        },
      },
    );
  }

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
      {feedback && (
        <div
          role="alert"
          className={`rounded-xl border p-4 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

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
                placeholder="Nome, e-mail, CPF ou papel"
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
            users={paginatedUsers}
            onEdit={setEditingUser}
            onDelete={handleDeleteUser}
            isBusy={isManaging}
          />
        )}

        {filteredUsers.length > SCHOOL_USERS_PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe3e8] bg-white px-3 py-2 text-sm text-gray-600">
            <span>
              Mostrando {pageStart + 1}–
              {Math.min(
                pageStart + SCHOOL_USERS_PAGE_SIZE,
                filteredUsers.length,
              )}{' '}
              de {filteredUsers.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                title="Página anterior"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.max(1, page - 1),
                  )
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dfe3e8] px-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Anterior
              </button>

              <span className="whitespace-nowrap font-medium text-gray-700">
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                aria-label="Próxima página"
                title="Próxima página"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1),
                  )
                }
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dfe3e8] px-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
                <ChevronRight
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        )}
      </section>

      {editingUser && (
        <SchoolUserEditDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSubmit={handleEditSubmit}
          isSubmitting={isManaging}
        />
      )}
    </div>
  );
}

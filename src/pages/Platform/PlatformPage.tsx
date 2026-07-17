import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  PauseCircle,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { useAuth } from '../../contexts/AuthContext';
import {
  useAccounts,
  useCreateClientAccount,
  useDeleteClientAccount,
  useUpdateClientAccount,
} from '../../hooks/useAccounts';
import type { AccountStatus } from '../../lib/permissions';
import {
  AccountServiceError,
  type AccountSummaryRow,
} from '../../services/accountService';

interface AccountFormState {
  accountName: string;
  adminFullName: string;
  adminEmail: string;
  institutionLimit: string;
}

type AccountFormFieldErrors = Partial<
  Record<keyof AccountFormState, string>
>;

interface DeleteDialogState {
  account: AccountSummaryRow;
  confirmation: string;
  error: string | null;
}

type StatusFilter = 'ALL' | AccountStatus;

const initialForm: AccountFormState = {
  accountName: '',
  adminFullName: '',
  adminEmail: '',
  institutionLimit: '1',
};

const statusLabels: Record<AccountStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Cancelada',
};

const statusStyles: Record<AccountStatus, string> = {
  ACTIVE: 'bg-[#e6f4ea] text-[#0f6d3a]',
  SUSPENDED: 'bg-[#fff4ce] text-[#7a4d00]',
  CANCELED: 'bg-[#ffdad6] text-[#93000a]',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Operacao nao concluida.';
}

function getCreateAccountFieldErrors(
  error: unknown,
): AccountFormFieldErrors {
  if (!(error instanceof AccountServiceError)) {
    return {};
  }

  const fieldErrors = error.fieldErrors ?? {};

  if (fieldErrors.adminEmail) {
    return {
      adminEmail: fieldErrors.adminEmail,
    };
  }

  if (
    error.code === 'EMAIL_ALREADY_REGISTERED' ||
    error.code === 'AUTH_USER_ALREADY_EXISTS'
  ) {
    return {
      adminEmail: 'Este e-mail já está cadastrado.',
    };
  }

  if (error.code === 'SUPER_ADMIN_EMAIL_RESERVED') {
    return {
      adminEmail:
        'Este e-mail pertence ao Super Administrador.',
    };
  }

  if (error.code === 'EMAIL_BELONGS_TO_ACCOUNT_OWNER') {
    return {
      adminEmail:
        'Este usuário já administra outra conta.',
    };
  }

  return {};
}

function getDeleteAccountErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof AccountServiceError &&
    error.code === 'ACCOUNT_NOT_EMPTY'
  ) {
    return 'Esta conta possui instituições ou vínculos e não pode ser excluída.';
  }

  return getErrorMessage(error);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatInstitutionNames(account: AccountSummaryRow): string {
  if (account.institutions.length === 0) {
    return 'Nenhuma instituicao cadastrada.';
  }

  const visibleNames = account.institutions
    .slice(0, 3)
    .map((institution) => institution.name)
    .join(', ');

  const hiddenCount = account.institutions.length - 3;

  if (hiddenCount <= 0) {
    return visibleNames;
  }

  return `${visibleNames} e mais ${hiddenCount}.`;
}

function accountMatchesSearch(
  account: AccountSummaryRow,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  const searchableText = [
    account.name,
    account.owner?.full_name,
    account.owner?.email,
    ...account.institutions.map(
      (institution) => institution.name,
    ),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR');

  return searchableText.includes(query);
}

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = 'primary',
}: {
  label: string;
  value: number;
  helper: string;
  tone?: 'primary' | 'secondary' | 'neutral';
}) {
  const toneClasses = {
    primary: 'bg-[#dce1ff] text-[#00236f]',
    secondary: 'bg-[#6ffbbe] text-[#002113]',
    neutral: 'bg-[#f3f4f5] text-[#444651]',
  }[tone];

  return (
    <article className="rounded-2xl border border-[#c5c5d3]/60 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${toneClasses}`}
        >
          <Building2
            className="h-5 w-5"
            aria-hidden="true"
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase leading-4 text-[#444651]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-8 text-[#191c1d]">
            {value}
          </p>
          <p className="mt-1 text-xs leading-4 text-[#444651]">
            {helper}
          </p>
        </div>
      </div>
    </article>
  );
}

function Field({
  id,
  label,
  children,
  error,
}: {
  id: string;
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-[#444651]"
      >
        {label}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="text-xs font-medium text-[#93000a]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default function PlatformPage() {
  const { profile } = useAuth();
  const accountsQuery = useAccounts();
  const createAccount = useCreateClientAccount();
  const updateAccount = useUpdateClientAccount();
  const deleteAccount = useDeleteClientAccount();

  const [form, setForm] =
    useState<AccountFormState>(initialForm);
  const [formFieldErrors, setFormFieldErrors] =
    useState<AccountFormFieldErrors>({});
  const [limitDrafts, setLimitDrafts] = useState<
    Record<string, string>
  >({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [deleteDialog, setDeleteDialog] =
    useState<DeleteDialogState | null>(null);

  const accounts = accountsQuery.data ?? [];
  const canDeleteAccounts =
    profile?.platform_role === 'SUPER_ADMIN';

  const totals = useMemo(
    () => ({
      accounts: accounts.length,
      activeAccounts: accounts.filter(
        (account) => account.status === 'ACTIVE',
      ).length,
      suspendedAccounts: accounts.filter(
        (account) => account.status === 'SUSPENDED',
      ).length,
      institutions: accounts.reduce(
        (sum, account) => sum + account.institutions.length,
        0,
      ),
      activeInstitutions: accounts.reduce(
        (sum, account) =>
          sum + account.activeInstitutionCount,
        0,
      ),
      capacity: accounts.reduce(
        (sum, account) =>
          sum + account.institutionLimit,
        0,
      ),
    }),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLocaleLowerCase('pt-BR');

    return accounts.filter((account) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        account.status === statusFilter;

      return (
        matchesStatus &&
        accountMatchesSearch(account, normalizedSearch)
      );
    });
  }, [accounts, searchTerm, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== 'ALL';
  const deleteDialogOwner =
    deleteDialog?.account.owner ?? null;
  const deleteConfirmationMatches = Boolean(
    deleteDialogOwner?.email &&
      deleteDialog?.confirmation ===
        deleteDialogOwner.email,
  );
  const deletePreservesSuperAdmin =
    deleteDialogOwner?.platform_role === 'SUPER_ADMIN';

  function clearFilters(): void {
    setSearchTerm('');
    setStatusFilter('ALL');
  }

  function updateCreateForm(
    field: keyof AccountFormState,
    value: string,
  ): void {
    setFormFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFeedback(null);
    setFormFieldErrors({});

    const institutionLimit = Number(
      form.institutionLimit,
    );

    if (
      !form.accountName.trim() ||
      !form.adminFullName.trim() ||
      !form.adminEmail.trim() ||
      !Number.isInteger(institutionLimit) ||
      institutionLimit < 1
    ) {
      setFeedback({
        type: 'error',
        message:
          'Informe conta, ADMIN e limite valido.',
      });
      return;
    }

    try {
      const response =
        await createAccount.mutateAsync({
          accountName: form.accountName,
          adminFullName: form.adminFullName,
          adminEmail: form.adminEmail,
          institutionLimit,
        });

      setForm(initialForm);
      setFeedback({
        type: 'success',
        message: response.invitationSent
          ? 'Conta criada e convite enviado ao ADMIN.'
          : 'Conta criada.',
      });
    } catch (error) {
      setFormFieldErrors(
        getCreateAccountFieldErrors(error),
      );
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  function openDeleteDialog(account: AccountSummaryRow): void {
    setFeedback(null);
    setDeleteDialog({
      account,
      confirmation: '',
      error: null,
    });
  }

  function closeDeleteDialog(): void {
    if (deleteAccount.isPending) {
      return;
    }

    setDeleteDialog(null);
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!deleteDialog || deleteAccount.isPending) {
      return;
    }

    const ownerEmail =
      deleteDialog.account.owner?.email ?? '';

    if (deleteDialog.confirmation !== ownerEmail) {
      setDeleteDialog((current) =>
        current
          ? {
              ...current,
              error:
                'Digite o e-mail do administrador para confirmar.',
            }
          : current,
      );
      return;
    }

    try {
      const response =
        await deleteAccount.mutateAsync({
          accountId: deleteDialog.account.id,
        });

      setDeleteDialog(null);
      setFeedback({
        type: 'success',
        message: response.ownerPreserved
          ? 'A conta indevida foi removida e o Super Administrador foi preservado.'
          : 'Conta vazia e administrador excluídos.',
      });
    } catch (error) {
      setDeleteDialog((current) =>
        current
          ? {
              ...current,
              error:
                getDeleteAccountErrorMessage(error),
            }
          : current,
      );
    }
  }

  async function updateLimit(
    accountId: string,
    fallbackLimit: number,
  ): Promise<void> {
    const nextLimit = Number(
      limitDrafts[accountId] ?? fallbackLimit,
    );

    if (
      !Number.isInteger(nextLimit) ||
      nextLimit < 1
    ) {
      setFeedback({
        type: 'error',
        message: 'Informe um limite maior que zero.',
      });
      return;
    }

    try {
      await updateAccount.mutateAsync({
        accountId,
        institutionLimit: nextLimit,
      });
      setFeedback({
        type: 'success',
        message: 'Limite atualizado.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  async function updateStatus(
    accountId: string,
    status: AccountStatus,
  ): Promise<void> {
    try {
      await updateAccount.mutateAsync({
        accountId,
        status,
      });
      setFeedback({
        type: 'success',
        message: 'Status da conta atualizado.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] px-4 py-6 text-[#191c1d] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <header className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="h-6 w-6 text-[#00236f]"
                aria-hidden="true"
              />
              <h1 className="text-[32px] font-bold leading-10 text-[#191c1d]">
                Instituições
              </h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[#444651]">
              Gerencie as instituições vinculadas às contas da plataforma.
            </p>
          </div>
        </header>

        {feedback && (
          <div
            role="alert"
            className={`rounded-xl border p-4 text-sm ${
              feedback.type === 'success'
                ? 'border-[#6ffbbe] bg-[#effdf6] text-[#005236]'
                : 'border-[#ffdad6] bg-[#fff1ef] text-[#93000a]'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Indicadores reais de instituições"
        >
          <MetricCard
            label="Instituições"
            value={totals.institutions}
            helper={`${totals.activeInstitutions} ativas`}
          />
          <MetricCard
            label="Contas ativas"
            value={totals.activeAccounts}
            helper={`${totals.accounts} contas no total`}
            tone="secondary"
          />
          <MetricCard
            label="Contas suspensas"
            value={totals.suspendedAccounts}
            helper="Status operacional real"
            tone="neutral"
          />
          <MetricCard
            label="Capacidade"
            value={totals.capacity}
            helper="Limite somado das contas"
          />
        </section>

        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-[#c5c5d3]/60 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold leading-7 text-[#191c1d]">
              Nova conta cliente
            </h2>
            <p className="text-sm leading-5 text-[#444651]">
              Crie a conta comercial e envie o convite real para o ADMIN.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field
              id="account-name"
              label="Nome da conta"
              error={formFieldErrors.accountName}
            >
              <input
                id="account-name"
                value={form.accountName}
                onChange={(event) =>
                  updateCreateForm(
                    'accountName',
                    event.target.value,
                  )
                }
                aria-invalid={Boolean(
                  formFieldErrors.accountName,
                )}
                placeholder="Nome da conta"
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
            <Field
              id="admin-name"
              label="Nome do ADMIN"
              error={formFieldErrors.adminFullName}
            >
              <input
                id="admin-name"
                value={form.adminFullName}
                onChange={(event) =>
                  updateCreateForm(
                    'adminFullName',
                    event.target.value,
                  )
                }
                aria-invalid={Boolean(
                  formFieldErrors.adminFullName,
                )}
                placeholder="Nome do ADMIN"
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
            <Field
              id="admin-email"
              label="Email do ADMIN"
              error={formFieldErrors.adminEmail}
            >
              <input
                id="admin-email"
                type="email"
                value={form.adminEmail}
                onChange={(event) =>
                  updateCreateForm(
                    'adminEmail',
                    event.target.value,
                  )
                }
                aria-invalid={Boolean(
                  formFieldErrors.adminEmail,
                )}
                aria-describedby={
                  formFieldErrors.adminEmail
                    ? 'admin-email-error'
                    : undefined
                }
                placeholder="admin@cliente.com"
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
            <Field
              id="institution-limit"
              label="Limite de instituições"
              error={formFieldErrors.institutionLimit}
            >
              <input
                id="institution-limit"
                type="number"
                min={1}
                value={form.institutionLimit}
                onChange={(event) =>
                  updateCreateForm(
                    'institutionLimit',
                    event.target.value,
                  )
                }
                aria-invalid={Boolean(
                  formFieldErrors.institutionLimit,
                )}
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={createAccount.isPending}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createAccount.isPending ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Plus
                className="h-4 w-4"
                aria-hidden="true"
              />
            )}
            Criar conta
          </button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#c5c5d3]/60 bg-white shadow-sm">
          <div className="border-b border-[#c5c5d3]/60 bg-[#f3f4f5] px-5 py-4">
            <h2 className="text-xl font-semibold leading-7 text-[#191c1d]">
              Contas e instituições
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#444651]">
              Uso de instituições por conta, limites e status operacional.
            </p>
          </div>

          <div className="border-b border-[#c5c5d3]/60 bg-white px-5 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
              <Field
                id="platform-account-search"
                label="Buscar conta ou instituição"
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757682]"
                    aria-hidden="true"
                  />
                  <input
                    id="platform-account-search"
                    type="search"
                    value={searchTerm}
                    onChange={(event) =>
                      setSearchTerm(event.target.value)
                    }
                    placeholder="Conta, ADMIN ou instituição"
                    className="h-10 w-full rounded-lg border border-[#c5c5d3] px-9 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                  />
                </div>
              </Field>

              <Field
                id="platform-status-filter"
                label="Status"
              >
                <select
                  id="platform-status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as StatusFilter,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-[#c5c5d3] bg-white px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                >
                  <option value="ALL">Todos</option>
                  <option value="ACTIVE">Ativas</option>
                  <option value="SUSPENDED">Suspensas</option>
                  <option value="CANCELED">Canceladas</option>
                </select>
              </Field>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Limpar
              </button>
            </div>
          </div>

          {accountsQuery.isLoading ? (
            <div
              role="status"
              className="flex items-center gap-2 p-5 text-sm text-[#444651]"
            >
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Carregando instituições...
            </div>
          ) : accountsQuery.isError ? (
            <div
              role="alert"
              className="p-5 text-sm text-[#93000a]"
            >
              {getErrorMessage(accountsQuery.error)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-5 text-sm text-[#444651]">
              Nenhuma conta ou instituição cadastrada.
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-5 text-sm text-[#444651]">
              Nenhuma conta encontrada para os filtros informados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <caption className="sr-only">
                  Contas e instituições da plataforma
                </caption>
                <thead className="bg-[#f3f4f5] text-[11px] uppercase leading-4 text-[#444651]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      Conta
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      ADMIN
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Uso
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Limite
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Instituições
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c5c5d3]/50">
                  {filteredAccounts.map((account) => {
                    const draft =
                      limitDrafts[account.id] ??
                      String(account.institutionLimit);
                    const usagePercent =
                      account.institutionLimit > 0
                        ? Math.min(
                            100,
                            Math.round(
                              (account.activeInstitutionCount /
                                account.institutionLimit) *
                                100,
                            ),
                          )
                        : 0;

                    return (
                      <tr
                        key={account.id}
                        className="transition hover:bg-[#f8f9fa]"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dce1ff] text-xs font-bold text-[#00236f]">
                              {getInitials(account.name)}
                            </div>
                            <div>
                              <p className="font-semibold text-[#191c1d]">
                                {account.name}
                              </p>
                              <p className="text-xs text-[#444651]">
                                {account.institutions.length} instituições
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[#444651]">
                          <p className="font-medium text-[#191c1d]">
                            {account.owner?.full_name ??
                              'Sem owner'}
                          </p>
                          <p className="text-xs">
                            {account.owner?.email ?? ''}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={account.status} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="w-36">
                            <div className="flex justify-between text-xs text-[#444651]">
                              <span>
                                {account.activeInstitutionCount}/
                                {account.institutionLimit}
                              </span>
                              <span>{usagePercent}%</span>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-[#edeeef]">
                              <div
                                className="h-2 rounded-full bg-[#006c49]"
                                style={{
                                  width: `${usagePercent}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <input
                              aria-label={`Limite de ${account.name}`}
                              type="number"
                              min={1}
                              value={draft}
                              onChange={(event) =>
                                setLimitDrafts(
                                  (current) => ({
                                    ...current,
                                    [account.id]:
                                      event.target.value,
                                  }),
                                )
                              }
                              className="h-9 w-20 rounded-lg border border-[#c5c5d3] px-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void updateLimit(
                                  account.id,
                                  account.institutionLimit,
                                )
                              }
                              disabled={updateAccount.isPending}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#1e3a8a] transition hover:bg-[#dce1ff] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Salvar limite de ${account.name}`}
                              title="Salvar limite"
                            >
                              <Save
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </td>
                        <td className="max-w-xs px-4 py-4 text-sm leading-5 text-[#444651]">
                          {formatInstitutionNames(account)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {account.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateStatus(
                                    account.id,
                                    'SUSPENDED',
                                  )
                                }
                                disabled={updateAccount.isPending}
                                className="inline-flex items-center gap-2 rounded-lg border border-[#ffb95f] px-3 py-1.5 text-xs font-semibold text-[#7a4d00] transition hover:bg-[#fff4ce] focus:outline-none focus:ring-2 focus:ring-[#ffb95f]/40 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <PauseCircle
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Suspender
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateStatus(
                                    account.id,
                                    'ACTIVE',
                                  )
                                }
                                disabled={updateAccount.isPending}
                                className="inline-flex items-center gap-2 rounded-lg border border-[#6ffbbe] px-3 py-1.5 text-xs font-semibold text-[#005236] transition hover:bg-[#effdf6] focus:outline-none focus:ring-2 focus:ring-[#6ffbbe]/50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {account.status === 'CANCELED' ? (
                                  <RotateCcw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <CheckCircle2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                )}
                                Reativar
                              </button>
                            )}
                            {canDeleteAccounts &&
                              account.owner?.email && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDeleteDialog(account)
                                  }
                                  disabled={
                                    deleteAccount.isPending
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-[#ffdad6] px-3 py-1.5 text-xs font-semibold text-[#93000a] transition hover:bg-[#fff1ef] focus:outline-none focus:ring-2 focus:ring-[#ffdad6]/70 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Excluir administrador de ${account.name}`}
                                >
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Excluir administrador
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {deleteDialog && deleteDialogOwner && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="delete-account-title"
                    className="text-xl font-semibold leading-7 text-[#191c1d]"
                  >
                    Excluir conta e administrador
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#444651]">
                    Ao excluir o único administrador, esta conta vazia também será removida.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  disabled={deleteAccount.isPending}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Fechar modal de exclusão"
                >
                  <X
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="mt-4 space-y-3 rounded-lg border border-[#c5c5d3]/70 bg-[#f8f9fa] p-4 text-sm text-[#444651]">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#757682]">
                    Conta
                  </p>
                  <p className="mt-1 font-semibold text-[#191c1d]">
                    {deleteDialog.account.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#757682]">
                    Administrador
                  </p>
                  <p className="mt-1 font-semibold text-[#191c1d]">
                    {deleteDialogOwner.full_name}
                  </p>
                  <p>{deleteDialogOwner.email}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-3 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-4 text-sm leading-5 text-[#93000a]">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  Esta ação é irreversível. Contas com instituições ou vínculos não podem ser excluídas.
                  {deletePreservesSuperAdmin
                    ? ' O Super Administrador será preservado.'
                    : ''}
                </p>
              </div>

              {deleteDialog.error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-3 text-sm text-[#93000a]"
                >
                  {deleteDialog.error}
                </div>
              )}

              <div className="mt-4">
                <label
                  htmlFor="delete-account-confirmation"
                  className="block text-xs font-semibold text-[#444651]"
                >
                  Digite o e-mail do administrador para confirmar
                </label>
                <input
                  id="delete-account-confirmation"
                  type="email"
                  value={deleteDialog.confirmation}
                  onChange={(event) =>
                    setDeleteDialog((current) =>
                      current
                        ? {
                            ...current,
                            confirmation:
                              event.target.value,
                            error: null,
                          }
                        : current,
                    )
                  }
                  disabled={deleteAccount.isPending}
                  className="mt-1 h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5]"
                />
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteDialog}
                  disabled={deleteAccount.isPending}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteAccount()}
                  disabled={
                    !deleteConfirmationMatches ||
                    deleteAccount.isPending
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#93000a] px-4 text-sm font-semibold text-white transition hover:bg-[#730006] focus:outline-none focus:ring-2 focus:ring-[#93000a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleteAccount.isPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Excluir
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

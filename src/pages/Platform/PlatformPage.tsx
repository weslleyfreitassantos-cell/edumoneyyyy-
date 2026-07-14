import {
  Building2,
  CheckCircle2,
  Loader2,
  PauseCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import {
  useAccounts,
  useCreateClientAccount,
  useUpdateClientAccount,
} from '../../hooks/useAccounts';
import type { AccountStatus } from '../../lib/permissions';
import type { AccountSummaryRow } from '../../services/accountService';

interface AccountFormState {
  accountName: string;
  adminFullName: string;
  adminEmail: string;
  institutionLimit: string;
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
}: {
  id: string;
  label: string;
  children: ReactNode;
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
    </div>
  );
}

export default function PlatformPage() {
  const accountsQuery = useAccounts();
  const createAccount = useCreateClientAccount();
  const updateAccount = useUpdateClientAccount();
  const formRef = useRef<HTMLFormElement | null>(null);
  const accountNameInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] =
    useState<AccountFormState>(initialForm);
  const [limitDrafts, setLimitDrafts] = useState<
    Record<string, string>
  >({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);

  const accounts = accountsQuery.data ?? [];

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

  function focusCreateForm(): void {
    formRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    accountNameInputRef.current?.focus({
      preventScroll: true,
    });
  }

  function clearFilters(): void {
    setSearchTerm('');
    setStatusFilter('ALL');
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFeedback(null);

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
          : 'Conta criada reutilizando usuario existente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
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
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void accountsQuery.refetch()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
            >
              <RefreshCw
                className="h-4 w-4"
                aria-hidden="true"
              />
              Atualizar
            </button>
            <button
              type="button"
              onClick={focusCreateForm}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1e3a8a] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
            >
              <Plus
                className="h-4 w-4"
                aria-hidden="true"
              />
              Nova conta
            </button>
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
          ref={formRef}
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
            >
              <input
                ref={accountNameInputRef}
                id="account-name"
                value={form.accountName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    accountName: event.target.value,
                  }))
                }
                placeholder="Nome da conta"
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
            <Field
              id="admin-name"
              label="Nome do ADMIN"
            >
              <input
                id="admin-name"
                value={form.adminFullName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    adminFullName: event.target.value,
                  }))
                }
                placeholder="Nome do ADMIN"
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
            <Field
              id="admin-email"
              label="Email do ADMIN"
            >
              <input
                id="admin-email"
                type="email"
                value={form.adminEmail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    adminEmail: event.target.value,
                  }))
                }
                placeholder="admin@cliente.com"
                className="h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              />
            </Field>
            <Field
              id="institution-limit"
              label="Limite de instituições"
            >
              <input
                id="institution-limit"
                type="number"
                min={1}
                value={form.institutionLimit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    institutionLimit: event.target.value,
                  }))
                }
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

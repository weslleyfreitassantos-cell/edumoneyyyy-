import {
  Building2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  useAccounts,
  useCreateClientAccount,
  useUpdateClientAccount,
} from '../../hooks/useAccounts';
import type { AccountStatus } from '../../lib/permissions';

interface AccountFormState {
  accountName: string;
  adminFullName: string;
  adminEmail: string;
  institutionLimit: string;
}

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Operacao nao concluida.';
}

export default function PlatformPage() {
  const accountsQuery = useAccounts();
  const createAccount = useCreateClientAccount();
  const updateAccount = useUpdateClientAccount();

  const [form, setForm] =
    useState<AccountFormState>(initialForm);
  const [limitDrafts, setLimitDrafts] = useState<
    Record<string, string>
  >({});
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);

  const accounts = accountsQuery.data ?? [];

  const totals = useMemo(
    () => ({
      accounts: accounts.length,
      active: accounts.filter(
        (account) => account.status === 'ACTIVE',
      ).length,
      institutions: accounts.reduce(
        (sum, account) =>
          sum + account.activeInstitutionCount,
        0,
      ),
    }),
    [accounts],
  );

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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="h-6 w-6 text-[#005bbf]"
                aria-hidden="true"
              />
              <h1 className="text-2xl font-bold text-[#181c20]">
                Plataforma
              </h1>
            </div>

            <p className="mt-1 text-sm text-[#727785]">
              Contas comerciais, limites e status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void accountsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#dfe3e8] bg-white px-4 py-2 text-sm font-semibold text-[#414754] hover:bg-gray-50"
          >
            <RefreshCw
              className="h-4 w-4"
              aria-hidden="true"
            />
            Atualizar
          </button>
        </header>

        {feedback && (
          <div
            role="alert"
            className={`rounded-lg border p-4 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-lg border border-[#dfe3e8] bg-white p-4">
            <p className="text-xs font-semibold text-[#727785]">
              Contas
            </p>
            <p className="mt-2 text-2xl font-bold text-[#181c20]">
              {totals.accounts}
            </p>
          </article>
          <article className="rounded-lg border border-[#dfe3e8] bg-white p-4">
            <p className="text-xs font-semibold text-[#727785]">
              Ativas
            </p>
            <p className="mt-2 text-2xl font-bold text-[#181c20]">
              {totals.active}
            </p>
          </article>
          <article className="rounded-lg border border-[#dfe3e8] bg-white p-4">
            <p className="text-xs font-semibold text-[#727785]">
              Instituicoes
            </p>
            <p className="mt-2 text-2xl font-bold text-[#181c20]">
              {totals.institutions}
            </p>
          </article>
        </section>

        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-[#dfe3e8] bg-white p-5"
        >
          <h2 className="text-lg font-bold text-[#181c20]">
            Nova conta
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              aria-label="Nome da conta"
              value={form.accountName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accountName: event.target.value,
                }))
              }
              placeholder="Nome da conta"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="Nome do ADMIN"
              value={form.adminFullName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  adminFullName: event.target.value,
                }))
              }
              placeholder="Nome do ADMIN"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="Email do ADMIN"
              type="email"
              value={form.adminEmail}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  adminEmail: event.target.value,
                }))
              }
              placeholder="admin@cliente.com"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="Limite de instituicoes"
              type="number"
              min={1}
              value={form.institutionLimit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  institutionLimit: event.target.value,
                }))
              }
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={createAccount.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004a9f] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {createAccount.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Criar conta
          </button>
        </form>

        <section className="rounded-lg border border-[#dfe3e8] bg-white">
          <div className="border-b border-[#dfe3e8] p-5">
            <h2 className="text-lg font-bold text-[#181c20]">
              Contas cadastradas
            </h2>
          </div>

          {accountsQuery.isLoading ? (
            <div className="p-5 text-sm text-[#727785]">
              Carregando contas...
            </div>
          ) : accountsQuery.isError ? (
            <div className="p-5 text-sm text-red-700">
              {getErrorMessage(accountsQuery.error)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-5 text-sm text-[#727785]">
              Nenhuma conta cadastrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-[#414754]">
                  <tr>
                    <th className="px-4 py-3">Conta</th>
                    <th className="px-4 py-3">ADMIN</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Uso</th>
                    <th className="px-4 py-3">Limite</th>
                    <th className="px-4 py-3">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const draft =
                      limitDrafts[account.id] ??
                      String(account.institutionLimit);

                    return (
                      <tr
                        key={account.id}
                        className="border-t"
                      >
                        <td className="px-4 py-3 font-semibold text-[#181c20]">
                          {account.name}
                        </td>
                        <td className="px-4 py-3 text-[#414754]">
                          {account.owner?.full_name ??
                            'Sem owner'}
                          <p className="text-xs text-[#727785]">
                            {account.owner?.email ?? ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {statusLabels[account.status]}
                        </td>
                        <td className="px-4 py-3">
                          {account.activeInstitutionCount}/
                          {account.institutionLimit}
                        </td>
                        <td className="px-4 py-3">
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
                              className="w-20 rounded-lg border border-[#dfe3e8] px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void updateLimit(
                                  account.id,
                                  account.institutionLimit,
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dfe3e8] text-[#005bbf] hover:bg-blue-50"
                              aria-label="Salvar limite"
                              title="Salvar limite"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
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
                                className="rounded-lg border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                              >
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
                                className="rounded-lg border border-green-200 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
                              >
                                Reativar
                              </button>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-[#727785]">
                              <Building2 className="h-3.5 w-3.5" />
                              {account.institutions.length}
                            </span>
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
      </div>
    </main>
  );
}

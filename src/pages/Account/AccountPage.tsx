import {
  Building2,
  DoorOpen,
  Loader2,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  useState,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { BrandingEditor } from '../../components/branding/BrandingEditor';
import { AccountDomainSection } from '../../components/branding/DomainManagement';
import { useAuth } from '../../contexts/AuthContext';
import {
  useInstitution,
  type SelectInstitutionResult,
} from '../../contexts/InstitutionContext';
import { AdminInstitutionSubdomainSection } from '../../components/account/AdminInstitutionSubdomainSection';
import {
  useCreateInstitution,
  useDeleteInstitution,
  useOwnedAccount,
  useUpdateInstitutionName,
  useUpdateInstitutionStatus,
} from '../../hooks/useAccounts';
import {
  useAccountBranding,
  useAccountDomains,
  useRequestAccountDomain,
  useSaveAccountBranding,
} from '../../hooks/useBranding';
import { getAccountStatusLabel } from '../../lib/statusLabels';
import { getInstitutionEntryUrl } from '../../lib/subdomain';
import {
  AccountServiceError,
  type AccountInstitutionSummary,
} from '../../services/accountService';

interface InstitutionFormState {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
}

const initialForm: InstitutionFormState = {
  name: '',
  cnpj: '',
  email: '',
  phone: '',
  address: '',
};

interface InstitutionEditState {
  id: string;
  name: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Operacao nao concluida.';
}

type SelectInstitutionFailure = Extract<
  SelectInstitutionResult,
  { success: false }
>;

function getSelectionFailureMessage(
  result: SelectInstitutionFailure,
): string {
  if (result.reason === 'REFETCH_FAILED') {
    return (
      result.message ??
      'A instituicao foi criada, mas nao foi possivel atualizar a lista de instituicoes.'
    );
  }

  return (
    result.message ??
    'A instituicao foi criada, mas ainda nao foi possivel ativa-la. Atualize a lista de instituicoes e tente seleciona-la novamente.'
  );
}

export default function AccountPage() {
  const { profile } = useAuth();
  const institutionContext = useInstitution();
  const navigate = useNavigate();
  const accountQuery = useOwnedAccount(profile?.id);
  const createInstitution = useCreateInstitution(profile?.id);
  const updateInstitutionName =
    useUpdateInstitutionName();
  const updateInstitutionStatus =
    useUpdateInstitutionStatus();
  const deleteInstitution = useDeleteInstitution();
  const accountId = accountQuery.data?.id;
  const accountBrandingQuery = useAccountBranding(accountId);
  const saveAccountBranding = useSaveAccountBranding(
    accountId ?? '',
  );
  const accountDomainsQuery = useAccountDomains(accountId);
  const requestAccountDomain = useRequestAccountDomain(
    accountId ?? '',
  );

  const [form, setForm] =
    useState<InstitutionFormState>(initialForm);
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [editingInstitution, setEditingInstitution] =
    useState<InstitutionEditState | null>(null);
  const [editInstitutionName, setEditInstitutionName] =
    useState('');
  const [editInstitutionError, setEditInstitutionError] =
    useState<string | null>(null);
  const [editedInstitutionNames, setEditedInstitutionNames] =
    useState<Record<string, string>>({});

  const account = accountQuery.data;
  const canEditInstitutions = profile?.role === 'ADMIN';
  const usedLicenses =
    account?.institutions.length ?? 0;
  const limit = account?.institutionLimit ?? 0;
  const remainingSlots = Math.max(
    limit - usedLicenses,
    0,
  );
  const canCreate =
    account?.status === 'ACTIVE' && remainingSlots > 0;

  async function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFeedback(null);

    if (!account) {
      return;
    }

    if (!form.name.trim()) {
      setFeedback({
        type: 'error',
        message: 'Informe o nome da instituicao.',
      });
      return;
    }

    try {
      const result =
        await createInstitution.mutateAsync({
          accountId: account.id,
          name: form.name,
          cnpj: form.cnpj || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
        });

      const selectionResult =
        await institutionContext.setCurrentInstitutionId(
          result.institutionId,
        );

      setForm(initialForm);

      if (selectionResult.success === false) {
        setFeedback({
          type: 'error',
          message:
            getSelectionFailureMessage(
              selectionResult,
            ),
        });
        return;
      }

      setFeedback({
        type: 'success',
        message:
          'Instituicao criada e selecionada com sucesso.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  async function handleSelectInstitution(
    institution: AccountInstitutionSummary,
    shouldNavigate = false,
  ): Promise<void> {
    try {
      const selectionResult =
        await institutionContext.setCurrentInstitutionId(
          institution.id,
        );

      if (selectionResult.success === true) {
        if (shouldNavigate) {
          const entryUrl = getInstitutionEntryUrl(
            window.location.hostname,
            institution.subdomain,
          );

          if (entryUrl) {
            window.location.assign(entryUrl);
            return;
          }

          navigate('/admin');
          return;
        }

        setFeedback({
          type: 'success',
          message: 'Instituicao selecionada.',
        });
        return;
      }

      if (selectionResult.success === false) {
        setFeedback({
          type: 'error',
          message:
            selectionResult.message ??
            'Nao foi possivel selecionar a instituicao. Atualize a lista e tente novamente.',
        });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  async function handleToggleInstitutionStatus(
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    setFeedback(null);

    try {
      await updateInstitutionStatus.mutateAsync({
        institutionId,
        active,
      });

      setFeedback({
        type: 'success',
        message: active
          ? 'Instituição reativada.'
          : 'Instituição suspensa. A licença continua ocupada.',
      });
    } catch (error) {
      const message = getErrorMessage(error);

      setFeedback({
        type: 'error',
        message:
          error instanceof AccountServiceError &&
          error.code === 'INSTITUTION_SUSPENDED_BY_PLATFORM'
            ? 'Esta instituição foi suspensa pela plataforma.'
            : message,
      });
    }
  }

  function openEditInstitutionDialog(
    institution: InstitutionEditState,
  ): void {
    setFeedback(null);
    setEditInstitutionError(null);
    setEditingInstitution(institution);
    setEditInstitutionName(institution.name);
  }

  function closeEditInstitutionDialog(): void {
    setEditingInstitution(null);
    setEditInstitutionName('');
    setEditInstitutionError(null);
  }

  async function handleEditInstitutionName(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!account || !editingInstitution) {
      return;
    }

    const normalizedName = editInstitutionName.trim();

    if (!normalizedName) {
      setEditInstitutionError(
        'Informe o nome da instituicao.',
      );
      return;
    }

    setEditInstitutionError(null);

    try {
      await updateInstitutionName.mutateAsync({
        institutionId: editingInstitution.id,
        name: normalizedName,
      });

      setEditedInstitutionNames((current) => ({
        ...current,
        [editingInstitution.id]: normalizedName,
      }));

      if (
        editingInstitution.id ===
        institutionContext.currentInstitutionId
      ) {
        await institutionContext.refresh();
      }

      closeEditInstitutionDialog();
      setFeedback({
        type: 'success',
        message: 'Nome da instituicao atualizado.',
      });
    } catch (error) {
      setEditInstitutionError(getErrorMessage(error));
    }
  }

  async function handleDeleteInstitution(
    institutionId: string,
    institutionName: string,
  ): Promise<void> {
    if (!account) {
      return;
    }

    const confirmed = window.confirm(
      `Excluir definitivamente a instituição "${institutionName}"? Esta ação libera uma licença e não pode ser desfeita.`,
    );

    if (!confirmed) {
      return;
    }

    setFeedback(null);

    try {
      await deleteInstitution.mutateAsync({
        accountId: account.id,
        institutionId,
      });

      if (
        institutionId ===
        institutionContext.currentInstitutionId
      ) {
        institutionContext.clearCurrentInstitutionSelection();
      }

      setFeedback({
        type: 'success',
        message:
          'Instituição excluída. A licença foi liberada.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getErrorMessage(error),
      });
    }
  }

  if (accountQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="text-sm text-[#727785]">
          Carregando conta...
        </div>
      </div>
    );
  }

  if (accountQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {getErrorMessage(accountQuery.error)}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
          Nenhuma conta comercial foi encontrada para este usuario.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <div>
            <div className="flex items-center gap-2">
              <Building2
                className="h-6 w-6 text-[#005bbf]"
                aria-hidden="true"
              />
              <h1 className="text-2xl font-bold text-[#181c20]">
                {account.name}
              </h1>
            </div>
            <p className="mt-1 text-sm text-[#727785]">
              Conta {getAccountStatusLabel(account.status)} Â·{' '}
              {usedLicenses}/{limit}{' '}
              instituições usadas
            </p>
          </div>
        </header>

        {account.status !== 'ACTIVE' && (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700"
          >
            Conta suspensa ou cancelada. Criacao de instituicoes e operacoes administrativas ficam bloqueadas.
          </div>
        )}

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
              Status
            </p>
            <p className="mt-2 text-xl font-bold text-[#181c20]">
              {getAccountStatusLabel(account.status)}
            </p>
          </article>
          <article className="rounded-lg border border-[#dfe3e8] bg-white p-4">
            <p className="text-xs font-semibold text-[#727785]">
              Limite
            </p>
            <p className="mt-2 text-xl font-bold text-[#181c20]">
              {limit}
            </p>
          </article>
          <article className="rounded-lg border border-[#dfe3e8] bg-white p-4">
            <p className="text-xs font-semibold text-[#727785]">
              Licenças restantes
            </p>
            <p className="mt-2 text-xl font-bold text-[#181c20]">
              {remainingSlots}
            </p>
          </article>
        </section>

        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-[#dfe3e8] bg-white p-5"
        >
          <h2 className="text-lg font-bold text-[#181c20]">
            Nova instituicao
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              aria-label="Nome da instituicao"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Nome"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="CNPJ"
              value={form.cnpj}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  cnpj: event.target.value,
                }))
              }
              placeholder="CNPJ opcional"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="Email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="Telefone"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder="Telefone"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
            <input
              aria-label="Endereco"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder="Endereco"
              className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={!canCreate || createInstitution.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004a9f] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {createInstitution.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Criar instituicao
          </button>
        </form>

        {(profile?.role === 'ADMIN' || Boolean(account)) && (
          <AdminInstitutionSubdomainSection />
        )}

        <section className="rounded-lg border border-[#dfe3e8] bg-white">
          <div className="border-b border-[#dfe3e8] p-5">
            <h2 className="text-lg font-bold text-[#181c20]">
              Instituicoes
            </h2>
          </div>
          {account.institutions.length === 0 ? (
            <div className="p-5 text-sm text-[#727785]">
              Nenhuma instituicao cadastrada.
            </div>
          ) : (
            <div className="divide-y divide-[#dfe3e8]">
              {account.institutions.map((institution) => {
                const isCurrentInstitution =
                  institution.id ===
                  institutionContext.currentInstitutionId;
                const institutionName =
                  editedInstitutionNames[institution.id] ??
                  institution.name;

                return (
                <div
                  key={institution.id}
                  className={`p-4 transition-colors ${
                    isCurrentInstitution
                      ? 'bg-[#e8f0ff] dark:bg-[#1e3a5f]/80'
                      : 'dark:bg-transparent'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#181c20] dark:text-[#f8fafc]">
                          {institutionName}
                        </p>
                        {isCurrentInstitution && (
                          <span className="rounded-full bg-[#dce8ff] px-2.5 py-1 text-[11px] font-bold text-[#061f6f] ring-1 ring-[#b7c8ff] dark:bg-[#0f2f63] dark:text-[#dbeafe] dark:ring-[#60a5fa]/40">
                            Selecionada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#727785] dark:text-[#cbd5e1]">
                        {institution.active === false
                          ? 'Inativa'
                          : 'Ativa'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isCurrentInstitution}
                        onClick={() =>
                          void handleSelectInstitution(
                            institution,
                            true,
                          )
                        }
                        aria-label={
                          isCurrentInstitution
                            ? 'Instituicao selecionada'
                            : `Entrar em ${institutionName}`
                        }
                        title={
                          isCurrentInstitution
                            ? 'Selecionada'
                            : 'Entrar'
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#005bbf] text-white hover:bg-[#004a9f] disabled:cursor-default disabled:bg-[#d8deea] disabled:text-[#414754] dark:disabled:bg-[#334155] dark:disabled:text-[#e2e8f0]"
                      >
                        <DoorOpen className="h-4 w-4" />
                        <span className="sr-only">
                          {isCurrentInstitution
                            ? 'Selecionada'
                            : 'Entrar'}
                        </span>
                      </button>
                      {canEditInstitutions && (
                        <button
                          type="button"
                          onClick={() =>
                            openEditInstitutionDialog({
                              id: institution.id,
                              name: institutionName,
                            })
                          }
                          aria-label={`Editar instituicao ${institutionName}`}
                          title="Editar instituicao"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={
                          updateInstitutionStatus.isPending
                        }
                        onClick={() =>
                          void handleToggleInstitutionStatus(
                            institution.id,
                            institution.active === false,
                          )
                        }
                        aria-label={`${institution.active === false ? 'Reativar' : 'Suspender'} ${institutionName}`}
                        title={
                          institution.active === false
                            ? 'Reativar'
                            : 'Suspender'
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {institution.active === false ? (
                          <PlayCircle className="h-4 w-4" />
                        ) : (
                          <PauseCircle className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={deleteInstitution.isPending}
                        onClick={() =>
                          void handleDeleteInstitution(
                            institution.id,
                            institutionName,
                          )
                        }
                        aria-label={`Excluir ${institutionName}`}
                        title="Excluir"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editingInstitution && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
        >
          <form
            onSubmit={(event) =>
              void handleEditInstitutionName(event)
            }
            aria-label="Editar instituicao"
            className="w-full max-w-md rounded-lg border border-[#dfe3e8] bg-white p-5 shadow-xl"
          >
            <div>
              <h2 className="text-lg font-bold text-[#181c20]">
                Editar instituicao
              </h2>
              <p className="mt-1 text-sm text-[#727785]">
                Altere somente o nome exibido da escola.
              </p>
            </div>

            {editInstitutionError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {editInstitutionError}
              </div>
            )}

            <label className="mt-4 block text-sm font-semibold text-[#414754]">
              Nome da instituicao
              <input
                value={editInstitutionName}
                onChange={(event) =>
                  setEditInstitutionName(event.target.value)
                }
                className="mt-2 w-full rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditInstitutionDialog}
                className="rounded-lg border border-[#dfe3e8] px-4 py-2 text-sm font-semibold text-[#414754] hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateInstitutionName.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004a9f] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {updateInstitutionName.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Salvar alteracoes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


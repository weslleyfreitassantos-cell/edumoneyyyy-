import {
  Building2,
  Loader2,
  Plus,
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
import {
  useCreateInstitution,
  useOwnedAccount,
} from '../../hooks/useAccounts';
import {
  useAccountBranding,
  useAccountDomains,
  useRequestAccountDomain,
  useSaveAccountBranding,
} from '../../hooks/useBranding';
import { getAccountStatusLabel } from '../../lib/statusLabels';

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

  const account = accountQuery.data;
  const activeCount =
    account?.activeInstitutionCount ?? 0;
  const limit = account?.institutionLimit ?? 0;
  const remainingSlots = Math.max(
    limit - activeCount,
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
    institutionId: string,
    shouldNavigate = false,
  ): Promise<void> {
    try {
      const selectionResult =
        await institutionContext.setCurrentInstitutionId(
          institutionId,
        );

      if (selectionResult.success === true) {
        if (shouldNavigate) {
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
              Conta {getAccountStatusLabel(account.status)} ·{' '}
              {activeCount}/{limit}{' '}
              instituicoes usadas
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

        <BrandingEditor
          title="Identidade da conta"
          description="Esta identidade sera exibida somente nos dominios ativos vinculados a esta conta."
          branding={accountBrandingQuery.data}
          isLoading={accountBrandingQuery.isLoading}
          isSaving={saveAccountBranding.isPending}
          onSave={(input) =>
            saveAccountBranding
              .mutateAsync(input)
              .then(() => undefined)
          }
        />

        <AccountDomainSection
          domains={accountDomainsQuery.data ?? []}
          isLoading={accountDomainsQuery.isLoading}
          isRequesting={requestAccountDomain.isPending}
          onRequestDomain={(hostname) =>
            requestAccountDomain
              .mutateAsync(hostname)
              .then(() => undefined)
          }
        />

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
              Slots restantes
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
              {account.institutions.map((institution) => (
                <div
                  key={institution.id}
                  className="p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-[#181c20]">
                        {institution.name}
                      </p>
                      <p className="text-xs text-[#727785]">
                        {institution.active === false
                          ? 'Inativa'
                          : 'Ativa'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleSelectInstitution(
                            institution.id,
                            true,
                          )
                        }
                        className="rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-semibold text-white hover:bg-[#004a9f]"
                      >
                        Entrar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

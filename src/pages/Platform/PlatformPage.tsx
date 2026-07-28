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
  X,
} from 'lucide-react';
import {
  useNavigate,
} from 'react-router-dom';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useAccounts,
  useAccountStatusEvents,
  useCloseClientAccount,
  useCreateClientAccount,
  useUpdateClientAccount,
  useUpdateInstitutionStatus,
} from '../../hooks/useAccounts';
import {
  useActivateDomain,
  useDisableDomain,
  useDomainRequests,
  useGlobalBranding,
  useSaveGlobalBranding,
} from '../../hooks/useBranding';
import type { AccountStatus } from '../../lib/permissions';
import {
  AccountServiceError,
  type AccountInstitutionSummary,
  type AccountSummaryRow,
} from '../../services/accountService';
import { BrandingEditor } from '../../components/branding/BrandingEditor';
import { PlatformDomainRequestsSection } from '../../components/branding/DomainManagement';

interface AccountFormState {
  adminFullName: string;
  adminEmail: string;
  institutionLimit: string;
}

type AccountFormFieldErrors = Partial<
  Record<keyof AccountFormState, string>
>;

interface CloseDialogState {
  account: AccountSummaryRow;
  confirmation: string;
  reason: string;
  error: string | null;
}

interface StatusHistoryDialogState {
  account: AccountSummaryRow;
}

interface InstitutionAccessDialogState {
  account: AccountSummaryRow;
  selectedInstitutionId: string;
  schoolSearch: string;
  error: string | null;
}

type StatusFilter = 'ALL' | AccountStatus;

const initialForm: AccountFormState = {
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

function getPlatformErrorMessage(error: unknown): string {
  if (error instanceof AccountServiceError) {
    if (
      error.code ===
      'INSTITUTION_LIMIT_BELOW_ACTIVE_INSTITUTIONS'
    ) {
      return 'O limite não pode ficar abaixo da quantidade de instituições ativas. Suspenda uma instituição antes de reduzir o limite.';
    }

    if (error.code === 'INSTITUTION_LIMIT_REACHED') {
      return 'A conta atingiu o limite de instituições ativas. Aumente o limite antes de reativar esta escola.';
    }

    if (error.code === 'PROFILE_INACTIVE') {
      return 'Seu usuário está desativado e não pode executar esta operação.';
    }
  }

  return getErrorMessage(error);
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
    fieldErrors.adminFullName ||
    fieldErrors.accountName
  ) {
    return {
      adminFullName:
        fieldErrors.adminFullName ??
        fieldErrors.accountName,
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

function getCloseAccountErrorMessage(
  error: unknown,
): string {
  return getPlatformErrorMessage(error);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getActiveAccountInstitutions(
  account: AccountSummaryRow,
): AccountInstitutionSummary[] {
  return account.institutions.filter(
    (institution) => institution.active !== false,
  );
}

function normalizeInstitutionSearch(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
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
    <div className="min-w-0 space-y-1.5">
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
  const navigate = useNavigate();
  const {
    setCurrentInstitutionId,
    clearCurrentInstitutionSelection,
    currentInstitutionId,
  } = useInstitution();
  const institutionSearchInputRef =
    useRef<HTMLInputElement | null>(null);
  const accountsQuery = useAccounts();
  const createAccount = useCreateClientAccount();
  const updateAccount = useUpdateClientAccount();
  const updateInstitutionStatusMutation =
    useUpdateInstitutionStatus();
  const closeAccount = useCloseClientAccount();
  const globalBrandingQuery = useGlobalBranding();
  const saveGlobalBranding = useSaveGlobalBranding();
  const domainRequestsQuery = useDomainRequests();
  const activateDomain = useActivateDomain();
  const disableDomain = useDisableDomain();

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
  const [closeDialog, setCloseDialog] =
    useState<CloseDialogState | null>(null);
  const [statusHistoryDialog, setStatusHistoryDialog] =
    useState<StatusHistoryDialogState | null>(null);
  const [
    institutionAccessDialog,
    setInstitutionAccessDialog,
  ] =
    useState<InstitutionAccessDialogState | null>(
      null,
    );
  const [isAccessingInstitution, setIsAccessingInstitution] =
    useState(false);

  const accounts = accountsQuery.data ?? [];
  const canCloseAccounts =
    profile?.platform_role === 'SUPER_ADMIN';
  const isSuperAdmin =
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
  const closeDialogOwner =
    closeDialog?.account.owner ?? null;
  const closeConfirmationMatches = Boolean(
    closeDialogOwner?.email &&
      closeDialog?.confirmation ===
        closeDialogOwner.email,
  );
  const closeReason = closeDialog?.reason.trim() ?? '';
  const closeReasonIsValid =
    closeReason.length >= 10 && closeReason.length <= 500;
  const institutionAccessDialogOwner =
    institutionAccessDialog?.account.owner ?? null;
  const statusEventsQuery = useAccountStatusEvents(
    statusHistoryDialog?.account.id,
    Boolean(statusHistoryDialog),
  );
  const institutionAccessOptions = useMemo(
    () =>
      institutionAccessDialog
        ? getActiveAccountInstitutions(
            institutionAccessDialog.account,
          )
        : [],
    [institutionAccessDialog],
  );
  const normalizedInstitutionAccessSearch =
    normalizeInstitutionSearch(
      institutionAccessDialog?.schoolSearch ?? '',
    );
  const visibleInstitutionAccessSearch =
    institutionAccessDialog?.schoolSearch
      .trim()
      .replace(/\s+/g, ' ') ?? '';
  const filteredInstitutionAccessOptions = useMemo(
    () =>
      normalizedInstitutionAccessSearch
        ? institutionAccessOptions.filter(
            (institution) =>
              normalizeInstitutionSearch(
                institution.name,
              ).includes(
                normalizedInstitutionAccessSearch,
              ),
          )
        : institutionAccessOptions,
    [
      institutionAccessOptions,
      normalizedInstitutionAccessSearch,
    ],
  );
  const institutionAccessResultCount =
    filteredInstitutionAccessOptions.length;
  const institutionAccessResultLabel =
    `${institutionAccessResultCount} ` +
    (institutionAccessResultCount === 1
      ? 'escola encontrada'
      : 'escolas encontradas');
  const canAccessSelectedInstitution = Boolean(
    institutionAccessDialog?.selectedInstitutionId &&
      institutionAccessOptions.some(
        (institution) =>
          institution.id ===
          institutionAccessDialog.selectedInstitutionId,
      ),
  );

  useEffect(() => {
    if (institutionAccessDialog) {
      institutionSearchInputRef.current?.focus();
    }
  }, [institutionAccessDialog?.account.id]);

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
    const normalizedAdminName =
      form.adminFullName.trim();
    const normalizedAdminEmail = form.adminEmail
      .trim()
      .toLocaleLowerCase();

    if (
      !normalizedAdminName ||
      !normalizedAdminEmail ||
      !Number.isInteger(institutionLimit) ||
      institutionLimit < 1
    ) {
      setFeedback({
        type: 'error',
        message:
          'Informe ADMIN, e-mail e limite valido.',
      });
      return;
    }

    try {
      const response =
        await createAccount.mutateAsync({
          accountName: normalizedAdminName,
          adminFullName: normalizedAdminName,
          adminEmail: normalizedAdminEmail,
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
        message: getPlatformErrorMessage(error),
      });
    }
  }

  function openCloseDialog(account: AccountSummaryRow): void {
    if (account.status === 'CANCELED') {
      return;
    }

    setFeedback(null);
    setCloseDialog({
      account,
      confirmation: '',
      reason: '',
      error: null,
    });
  }

  function closeCloseDialog(): void {
    if (closeAccount.isPending) {
      return;
    }

    setCloseDialog(null);
  }

  async function accessInstitutionById(
    institutionId: string,
    onError: (message: string) => void,
  ): Promise<void> {
    if (isAccessingInstitution) {
      return;
    }

    setIsAccessingInstitution(true);

    try {
      const result = await setCurrentInstitutionId(
        institutionId,
      );

      if (result.success === true) {
        setInstitutionAccessDialog(null);
        navigate('/admin');
        return;
      }

      onError(
        'message' in result && result.message
          ? result.message
          : 'Nao foi possivel acessar esta escola.',
      );
    } finally {
      setIsAccessingInstitution(false);
    }
  }

  async function openInstitutionAccessDialog(
    account: AccountSummaryRow,
  ): Promise<void> {
    if (account.status === 'SUSPENDED') {
      setFeedback({
        type: 'error',
        message:
          'Esta conta esta suspensa. Reative a conta antes de acessar suas escolas.',
      });
      return;
    }

    if (account.status === 'CANCELED') {
      setFeedback({
        type: 'error',
        message:
          'Esta conta foi encerrada. O acesso operacional as escolas esta bloqueado e o historico permanece preservado.',
      });
      return;
    }

    const activeInstitutions =
      getActiveAccountInstitutions(account);

    setFeedback(null);

    if (activeInstitutions.length === 0) {
      setFeedback({
        type: 'error',
        message:
          'Esta conta não possui escolas ativas para acessar.',
      });
      return;
    }

    if (activeInstitutions.length === 1) {
      await accessInstitutionById(
        activeInstitutions[0].id,
        (message) =>
          setFeedback({
            type: 'error',
            message,
          }),
      );
      return;
    }

    setInstitutionAccessDialog({
      account,
      selectedInstitutionId: '',
      schoolSearch: '',
      error: null,
    });
  }

  function closeInstitutionAccessDialog(): void {
    if (isAccessingInstitution) {
      return;
    }

    setInstitutionAccessDialog(null);
  }

  function clearInstitutionAccessSearch(): void {
    setInstitutionAccessDialog((current) =>
      current
        ? {
            ...current,
            schoolSearch: '',
            error: null,
          }
        : current,
    );
    institutionSearchInputRef.current?.focus();
  }

  function selectInstitutionAccessOption(
    institutionId: string,
  ): void {
    setInstitutionAccessDialog((current) =>
      current
        ? {
            ...current,
            selectedInstitutionId: institutionId,
            error: null,
          }
        : current,
    );
  }

  function handleInstitutionAccessKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeInstitutionAccessDialog();
    }
  }

  async function handleAccessInstitution(): Promise<void> {
    if (
      !institutionAccessDialog ||
      !institutionAccessDialog.selectedInstitutionId ||
      isAccessingInstitution
    ) {
      return;
    }

    setInstitutionAccessDialog((current) =>
      current
        ? {
            ...current,
            error: null,
          }
        : current,
    );

    await accessInstitutionById(
      institutionAccessDialog.selectedInstitutionId,
      (message) =>
        setInstitutionAccessDialog((current) =>
          current
            ? {
                ...current,
                error: message,
              }
            : current,
        ),
    );
  }

  async function handleCloseAccount(): Promise<void> {
    if (!closeDialog || closeAccount.isPending) {
      return;
    }

    const ownerEmail =
      closeDialog.account.owner?.email ?? '';

    if (closeDialog.confirmation !== ownerEmail) {
      setCloseDialog((current) =>
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

    if (!closeReasonIsValid) {
      setCloseDialog((current) =>
        current
          ? {
              ...current,
              error:
                'Informe um motivo entre 10 e 500 caracteres.',
            }
          : current,
      );
      return;
    }

    try {
      await closeAccount.mutateAsync({
        accountId: closeDialog.account.id,
        reason: closeReason,
      });

      const closedAccountInstitutionIds =
        closeDialog.account.institutions.map(
          (inst) => inst.id,
        );

      if (
        currentInstitutionId &&
        closedAccountInstitutionIds.includes(
          currentInstitutionId,
        )
      ) {
        clearCurrentInstitutionSelection();
      }

      setCloseDialog(null);
      navigate('/platform');
      setFeedback({
        type: 'success',
        message:
          'Conta encerrada. Dados e historico preservados.',
      });
    } catch (error) {
      setCloseDialog((current) =>
        current
          ? {
              ...current,
              error:
                getCloseAccountErrorMessage(error),
            }
          : current,
      );
    }
  }

  async function updateLimit(
    account: AccountSummaryRow,
  ): Promise<void> {
    if (account.status === 'CANCELED') {
      setFeedback({
        type: 'error',
        message:
          'Conta encerrada nao permite alteracao de limite.',
      });
      return;
    }

    const nextLimit = Number(
      limitDrafts[account.id] ??
        account.institutionLimit,
    );
    const minimumLimit = Math.max(
      1,
      account.activeInstitutionCount,
    );

    if (
      !Number.isInteger(nextLimit) ||
      nextLimit < minimumLimit
    ) {
      setFeedback({
        type: 'error',
        message:
          account.activeInstitutionCount > 0
            ? `O limite mínimo para ${account.name} é ${minimumLimit}, pois há ${account.activeInstitutionCount} instituições ativas. Suspenda instituições antes de reduzir.`
            : 'Informe um limite maior que zero.',
      });
      return;
    }

    try {
      await updateAccount.mutateAsync({
        accountId: account.id,
        institutionLimit: nextLimit,
      });
      setFeedback({
        type: 'success',
        message: `Limite de ${account.name} atualizado para ${nextLimit}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getPlatformErrorMessage(error),
      });
    }
  }

  async function updateStatus(
    accountId: string,
    status: AccountStatus,
  ): Promise<void> {
    const reason =
      status === 'SUSPENDED'
        ? window.prompt(
            'Informe o motivo da suspensao da conta (10 a 500 caracteres).',
          )?.trim() ?? ''
        : undefined;

    if (
      status === 'SUSPENDED' &&
      (reason.length < 10 || reason.length > 500)
    ) {
      setFeedback({
        type: 'error',
        message:
          'Informe um motivo entre 10 e 500 caracteres para suspender a conta.',
      });
      return;
    }

    try {
      await updateAccount.mutateAsync({
        accountId,
        status,
        reason,
      });
      setFeedback({
        type: 'success',
        message:
          status === 'ACTIVE'
            ? 'Conta reativada. As instituições e o histórico acadêmico foram preservados.'
            : 'Conta suspensa. As instituições e o histórico acadêmico foram preservados.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getPlatformErrorMessage(error),
      });
    }
  }

  async function changeInstitutionStatus(
    institution: AccountInstitutionSummary,
    active: boolean,
  ): Promise<void> {
    try {
      await updateInstitutionStatusMutation.mutateAsync({
        institutionId: institution.id,
        active,
      });
      setFeedback({
        type: 'success',
        message: active
          ? `${institution.name} reativada. Histórico acadêmico preservado.`
          : `${institution.name} suspensa. Histórico acadêmico preservado.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getPlatformErrorMessage(error),
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

        {isSuperAdmin && (
          <BrandingEditor
            title="Identidade da plataforma"
            description="Esta identidade e exibida no dominio principal da plataforma e serve como padrao para contas sem marca propria."
            branding={globalBrandingQuery.data}
            isLoading={globalBrandingQuery.isLoading}
            isSaving={saveGlobalBranding.isPending}
            onSave={(input) =>
              saveGlobalBranding
                .mutateAsync(input)
                .then(() => undefined)
            }
          />
        )}

        {isSuperAdmin && (
          <PlatformDomainRequestsSection
            domains={domainRequestsQuery.data ?? []}
            isLoading={domainRequestsQuery.isLoading}
            isMutating={
              activateDomain.isPending ||
              disableDomain.isPending
            }
            onActivate={(domainId) =>
              activateDomain
                .mutateAsync(domainId)
                .then(() => undefined)
            }
            onDisable={(domainId) =>
              disableDomain
                .mutateAsync(domainId)
                .then(() => undefined)
            }
          />
        )}

        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-[#c5c5d3]/60 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold leading-7 text-[#191c1d]">
              Novo cliente
            </h2>
            <p className="text-sm leading-5 text-[#444651]">
              Cadastre o administrador responsável e defina o limite de instituições.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,35fr)_minmax(0,40fr)_minmax(0,25fr)]">
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
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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
                    const minimumLimit = Math.max(
                      1,
                      account.activeInstitutionCount,
                    );

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
                          {account.owner &&
                          account.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void openInstitutionAccessDialog(
                                  account,
                                )
                              }
                              className="-m-1 max-w-full rounded-md p-1 text-left outline-none transition-colors hover:text-[#005bbf] focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
                              aria-label={`Acessar escolas de ${account.owner.full_name}`}
                            >
                              <span className="block truncate font-medium text-[#191c1d] transition-colors hover:text-[#005bbf]">
                                {account.owner.full_name}
                              </span>
                              <span className="block truncate text-xs">
                                {account.owner.email}
                              </span>
                            </button>
                          ) : (
                            <>
                              <p className="font-medium text-[#191c1d]">
                                {account.owner
                                  ? account.owner.full_name
                                  : 'Sem owner'}
                              </p>
                              <p className="text-xs">
                                {account.owner?.email ?? ''}
                              </p>
                            </>
                          )}
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
                              min={minimumLimit}
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
                              disabled={
                                account.status === 'CANCELED'
                              }
                              className="h-9 w-20 rounded-lg border border-[#c5c5d3] px-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5] disabled:text-[#757682]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                void updateLimit(
                                  account,
                                )
                              }
                              disabled={
                                updateAccount.isPending ||
                                account.status === 'CANCELED'
                              }
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
                        <td className="max-w-md px-4 py-4 text-sm leading-5 text-[#444651]">
                          {account.institutions.length === 0 ? (
                            <span>Nenhuma instituição cadastrada.</span>
                          ) : (
                            <div className="space-y-2">
                              {account.institutions.map(
                                (institution) => {
                                  const isActiveInstitution =
                                    institution.active !== false;

                                  return (
                                    <div
                                      key={institution.id}
                                      className="flex items-center justify-between gap-3 rounded-lg border border-[#d8deea] bg-white px-3 py-2"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-[#191c1d]">
                                          {institution.name}
                                        </p>
                                        <p
                                          className={`text-xs font-semibold ${
                                            isActiveInstitution
                                              ? 'text-[#005236]'
                                              : 'text-[#7a4d00]'
                                          }`}
                                        >
                                          {isActiveInstitution
                                            ? 'Ativa'
                                            : 'Suspensa'}
                                        </p>
                                      </div>

                                      {account.status ===
                                        'ACTIVE' && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void changeInstitutionStatus(
                                              institution,
                                              !isActiveInstitution,
                                            )
                                          }
                                          disabled={
                                            updateInstitutionStatusMutation.isPending
                                          }
                                          className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                                            isActiveInstitution
                                              ? 'border-[#ffb95f] text-[#7a4d00] hover:bg-[#fff4ce] focus:ring-[#ffb95f]/40'
                                              : 'border-[#6ffbbe] text-[#005236] hover:bg-[#effdf6] focus:ring-[#6ffbbe]/50'
                                          }`}
                                          aria-label={`${
                                            isActiveInstitution
                                              ? 'Suspender'
                                              : 'Reativar'
                                          } ${institution.name}`}
                                        >
                                          {isActiveInstitution ? (
                                            <PauseCircle
                                              className="h-4 w-4"
                                              aria-hidden="true"
                                            />
                                          ) : (
                                            <RotateCcw
                                              className="h-4 w-4"
                                              aria-hidden="true"
                                            />
                                          )}
                                          {isActiveInstitution
                                            ? 'Suspender'
                                            : 'Reativar'}
                                        </button>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}
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
                            ) : account.status ===
                              'SUSPENDED' ? (
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
                                <CheckCircle2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Reativar
                              </button>
                            ) : (
                              <span className="inline-flex max-w-xs items-center rounded-lg border border-[#ffdad6] bg-[#fff1ef] px-3 py-1.5 text-xs font-semibold text-[#93000a]">
                                Conta encerrada. Dados e
                                historico preservados.
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setStatusHistoryDialog({
                                  account,
                                })
                              }
                              className="inline-flex items-center gap-2 rounded-lg border border-[#c5c5d3] px-3 py-1.5 text-xs font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
                            >
                              Ver histórico
                            </button>
                            {canCloseAccounts &&
                              account.status !==
                                'CANCELED' &&
                              account.owner?.email && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCloseDialog(account)
                                  }
                                  disabled={
                                    closeAccount.isPending
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg border border-[#ffdad6] px-3 py-1.5 text-xs font-semibold text-[#93000a] transition hover:bg-[#fff1ef] focus:outline-none focus:ring-2 focus:ring-[#ffdad6]/70 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Encerrar conta ${account.name}`}
                                >
                                  <X
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Encerrar conta
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

        {institutionAccessDialog &&
          institutionAccessDialogOwner && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 dark:bg-black/60"
              role="presentation"
              onKeyDown={handleInstitutionAccessKeyDown}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="institution-access-title"
                className="max-h-[calc(100dvh-48px)] w-full max-w-[620px] overflow-y-auto rounded-xl border border-transparent bg-white p-5 shadow-xl dark:border-[#334155] dark:bg-[#182235]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2
                      id="institution-access-title"
                      className="text-xl font-semibold leading-7 text-[#191c1d] dark:text-[#f8fafc]"
                    >
                      Acessar escola da conta
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-[#444651] dark:text-[#cbd5e1]">
                      {institutionAccessDialog.account.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeInstitutionAccessDialog}
                    disabled={isAccessingInstitution}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#475569] dark:text-[#cbd5e1] dark:hover:bg-[#243247] dark:hover:text-[#f8fafc]"
                    aria-label="Fechar acesso a escola"
                  >
                    <X
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <div className="mt-3 grid gap-2 rounded-lg border border-[#c5c5d3]/70 bg-[#f8f9fa] p-3 text-sm text-[#444651] sm:grid-cols-2 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#757682]">
                      ADMIN
                    </p>
                    <p className="mt-0.5 font-semibold text-[#191c1d] dark:text-[#f8fafc]">
                      {institutionAccessDialogOwner.full_name}
                    </p>
                    <p className="truncate">
                      {institutionAccessDialogOwner.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#757682]">
                      Conta
                    </p>
                    <p className="mt-0.5 font-semibold text-[#191c1d] dark:text-[#f8fafc]">
                      {institutionAccessDialog.account.name}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="institution-access-search"
                    className="block text-xs font-semibold text-[#444651] dark:text-[#cbd5e1]"
                  >
                    Buscar escola
                  </label>
                  <div className="relative mt-1">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#757682] dark:text-[#94a3b8]"
                      aria-hidden="true"
                    />
                    <input
                      ref={institutionSearchInputRef}
                      id="institution-access-search"
                      type="search"
                      value={
                        institutionAccessDialog.schoolSearch
                      }
                      onChange={(event) =>
                        setInstitutionAccessDialog(
                          (current) =>
                            current
                              ? {
                                  ...current,
                                  schoolSearch:
                                    event.target.value,
                                  error: null,
                                }
                              : current,
                        )
                      }
                      disabled={
                        isAccessingInstitution ||
                        institutionAccessOptions.length === 0
                      }
                      placeholder="Digite o nome da escola..."
                      className="h-10 w-full rounded-lg border border-[#c5c5d3] bg-white px-9 text-sm text-[#191c1d] outline-none transition placeholder:text-[#757682] focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:placeholder:text-[#64748b] dark:disabled:bg-[#111827]"
                    />
                  </div>
                </div>

                {institutionAccessOptions.length === 0 ? (
                  <div
                    role="status"
                    className="mt-4 rounded-lg border border-[#c5c5d3]/70 bg-[#f8f9fa] p-4 text-sm text-[#444651] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]"
                  >
                    Nenhuma escola ativa nesta conta.
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#444651] dark:text-[#cbd5e1]">
                        {institutionAccessResultLabel}
                      </p>

                      {visibleInstitutionAccessSearch && (
                        <button
                          type="button"
                          onClick={clearInstitutionAccessSearch}
                          disabled={isAccessingInstitution}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-[#005bbf] outline-none transition hover:bg-[#eef3ff] focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#93c5fd] dark:hover:bg-[#243247]"
                        >
                          Limpar busca
                        </button>
                      )}
                    </div>

                    {filteredInstitutionAccessOptions.length > 0 ? (
                      <div
                        role="listbox"
                        aria-label="Escolas encontradas"
                        className="mt-2 max-h-[260px] overflow-y-auto rounded-lg border border-[#c5c5d3] bg-white p-1 dark:border-[#475569] dark:bg-[#0f172a]"
                      >
                        {filteredInstitutionAccessOptions.map(
                          (institution) => {
                            const isSelected =
                              institutionAccessDialog.selectedInstitutionId ===
                              institution.id;

                            return (
                              <button
                                key={institution.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() =>
                                  selectInstitutionAccessOption(
                                    institution.id,
                                  )
                                }
                                disabled={
                                  isAccessingInstitution
                                }
                                className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-not-allowed disabled:opacity-60 ${
                                  isSelected
                                    ? 'bg-[#e8f0ff] text-[#061f6f] dark:bg-[#1e3a5f] dark:text-[#dbeafe]'
                                    : 'text-[#191c1d] hover:bg-[#f3f4f5] dark:text-[#e2e8f0] dark:hover:bg-[#243247]'
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? 'border-[#005bbf] bg-[#005bbf] text-white dark:border-[#93c5fd] dark:bg-[#93c5fd] dark:text-[#0f172a]'
                                      : 'border-[#9aa4b2] bg-white dark:border-[#64748b] dark:bg-[#111827]'
                                  }`}
                                  aria-hidden="true"
                                >
                                  {isSelected && (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                </span>
                                <span className="min-w-0 truncate font-semibold">
                                  {institution.name}
                                </span>
                              </button>
                            );
                          },
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg border border-[#c5c5d3]/70 bg-[#f8f9fa] p-4 text-sm text-[#444651] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
                        Nenhuma escola encontrada para “{visibleInstitutionAccessSearch}”.
                      </div>
                    )}
                  </div>
                )}

                {institutionAccessDialog.error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-3 text-sm text-[#93000a] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                  >
                    {institutionAccessDialog.error}
                  </div>
                )}

                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeInstitutionAccessDialog}
                    disabled={isAccessingInstitution}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:border-[#475569] dark:bg-[#182235] dark:text-[#e2e8f0] dark:hover:bg-[#243247]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void handleAccessInstitution()
                    }
                    disabled={
                      !canAccessSelectedInstitution ||
                      isAccessingInstitution
                    }
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1e3a8a] px-4 text-sm font-semibold text-white transition hover:bg-[#00236f] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:focus:ring-offset-[#182235]"
                  >
                    {isAccessingInstitution ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Building2
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    Acessar escola
                  </button>
                </div>
              </section>
            </div>
          )}

        {statusHistoryDialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-history-title"
              className="max-h-[calc(100dvh-48px)] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="account-history-title"
                    className="text-xl font-semibold leading-7 text-[#191c1d]"
                  >
                    Histórico da conta
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#444651]">
                    {statusHistoryDialog.account.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setStatusHistoryDialog(null)
                  }
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
                  aria-label="Fechar histórico"
                >
                  <X
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-[#c5c5d3]/70 bg-[#f8f9fa] p-4 text-sm text-[#444651]">
                Os registros mostram mudanças de status
                auditadas. Dados acadêmicos e instituições
                permanecem preservados.
              </div>

              <div className="mt-4 space-y-3">
                {statusEventsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#444651]">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Carregando histórico...
                  </div>
                ) : statusEventsQuery.isError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-3 text-sm text-[#93000a]"
                  >
                    Não foi possível carregar o histórico.
                  </div>
                ) : statusEventsQuery.data?.length ? (
                  statusEventsQuery.data.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-lg border border-[#c5c5d3]/70 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={event.previousStatus}
                        />
                        <span className="text-[#757682]">
                          para
                        </span>
                        <StatusBadge
                          status={event.newStatus}
                        />
                      </div>
                      <p className="mt-2 text-[#191c1d]">
                        {event.reason ??
                          'Sem motivo registrado.'}
                      </p>
                      <p className="mt-2 text-xs text-[#757682]">
                        {new Date(
                          event.createdAt,
                        ).toLocaleString('pt-BR')}
                        {event.actorName
                          ? ` por ${event.actorName}`
                          : ''}
                        {event.actorEmail
                          ? ` (${event.actorEmail})`
                          : ''}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-lg border border-[#c5c5d3]/70 bg-[#f8f9fa] p-4 text-sm text-[#444651]">
                    Nenhuma mudança de status registrada.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {closeDialog && closeDialogOwner && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="close-account-title"
              className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="close-account-title"
                    className="text-xl font-semibold leading-7 text-[#191c1d]"
                  >
                    Encerrar conta
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#444651]">
                    Encerre o contrato comercial sem apagar
                    dados acadêmicos, instituições, perfis ou
                    histórico.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCloseDialog}
                  disabled={closeAccount.isPending}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Fechar modal de encerramento"
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
                    {closeDialog.account.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#757682]">
                    Administrador
                  </p>
                  <p className="mt-1 font-semibold text-[#191c1d]">
                    {closeDialogOwner.full_name}
                  </p>
                  <p>{closeDialogOwner.email}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-3 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-4 text-sm leading-5 text-[#93000a]">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  A conta ficará com status Cancelada e não
                  poderá ser reativada pelo aplicativo. O
                  administrador, as escolas e todo o histórico
                  acadêmico serão preservados.
                </p>
              </div>

              {closeDialog.error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-3 text-sm text-[#93000a]"
                >
                  {closeDialog.error}
                </div>
              )}

              <div className="mt-4">
                <label
                  htmlFor="close-account-reason"
                  className="block text-xs font-semibold text-[#444651]"
                >
                  Motivo do encerramento
                </label>
                <textarea
                  id="close-account-reason"
                  value={closeDialog.reason}
                  onChange={(event) =>
                    setCloseDialog((current) =>
                      current
                        ? {
                            ...current,
                            reason: event.target.value,
                            error: null,
                          }
                        : current,
                    )
                  }
                  minLength={10}
                  maxLength={500}
                  disabled={closeAccount.isPending}
                  className="mt-1 min-h-24 w-full rounded-lg border border-[#c5c5d3] px-3 py-2 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5]"
                />
                <p className="mt-1 text-xs text-[#757682]">
                  {closeReason.length}/500 caracteres
                </p>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="close-account-confirmation"
                  className="block text-xs font-semibold text-[#444651]"
                >
                  Digite o e-mail do administrador para confirmar
                </label>
                <input
                  id="close-account-confirmation"
                  type="email"
                  value={closeDialog.confirmation}
                  onChange={(event) =>
                    setCloseDialog((current) =>
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
                  disabled={closeAccount.isPending}
                  className="mt-1 h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5]"
                />
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCloseDialog}
                  disabled={closeAccount.isPending}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCloseAccount()}
                  disabled={
                    !closeConfirmationMatches ||
                    !closeReasonIsValid ||
                    closeAccount.isPending
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#93000a] px-4 text-sm font-semibold text-white transition hover:bg-[#730006] focus:outline-none focus:ring-2 focus:ring-[#93000a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {closeAccount.isPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Encerrar conta
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

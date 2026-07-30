import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  History,
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
  useDeleteClientAccount,
  useDeleteInstitution,
  useRestoreClientAccount,
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

interface PermanentDeleteDialogState {
  account: AccountSummaryRow;
  confirmation: string;
  typedConfirmationLiteral: string;
  understands: boolean;
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

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

const initialForm: AccountFormState = {
  adminFullName: '',
  adminEmail: '',
  institutionLimit: '1',
};

const statusLabels: Record<AccountStatus, string> = {
  ACTIVE: 'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELED: 'Excluída',
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

interface IconActionButtonProps {
  label: string;
  children: ReactNode;
  className: string;
  disabled?: boolean;
  onClick: () => void;
}

function IconActionButton({
  label,
  children,
  className,
  disabled,
  onClick,
}: IconActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
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
  const deleteInstitutionMutation =
    useDeleteInstitution();
  const closeAccount = useCloseClientAccount();
  const restoreAccount = useRestoreClientAccount();
  const permanentlyDeleteAccount =
    useDeleteClientAccount();
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
    useState<StatusFilter>('ACTIVE');
  const [feedback, setFeedback] = useState<
    { type: 'success' | 'error'; message: string } | null
  >(null);
  const [closeDialog, setCloseDialog] =
    useState<CloseDialogState | null>(null);
  const [permanentDeleteDialog, setPermanentDeleteDialog] =
    useState<PermanentDeleteDialogState | null>(null);
  const [restoreDialogAccount, setRestoreDialogAccount] =
    useState<AccountSummaryRow | null>(null);
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
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'DELETED'
            ? account.status === 'CANCELED'
            : account.status === statusFilter;

      return (
        matchesStatus &&
        accountMatchesSearch(account, normalizedSearch)
      );
    });
  }, [accounts, searchTerm, statusFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== 'ACTIVE';
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
  const permanentDeleteReason =
    permanentDeleteDialog?.reason.trim() ?? '';
  const permanentDeleteReasonIsValid =
    permanentDeleteReason.length >= 10 &&
    permanentDeleteReason.length <= 500;
  const permanentDeleteConfirmationMatches = Boolean(
    permanentDeleteDialog?.confirmation ===
      permanentDeleteDialog?.account.owner?.email,
  );
  const permanentDeleteLiteralMatches =
    permanentDeleteDialog?.typedConfirmationLiteral ===
    'EXCLUIR DEFINITIVAMENTE';
  const permanentDeleteCanSubmit = Boolean(
    permanentDeleteReasonIsValid &&
      permanentDeleteConfirmationMatches &&
      permanentDeleteLiteralMatches &&
      permanentDeleteDialog?.understands,
  );
  const institutionAccessDialogOwner =
    institutionAccessDialog?.account.owner ?? null;
  const statusEventsQuery = useAccountStatusEvents(
    statusHistoryDialog?.account.id,
    Boolean(statusHistoryDialog),
  );
  const institutionAccessOptions = useMemo(
    () =>
      institutionAccessDialog
        ? institutionAccessDialog.account.institutions
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
      institutionAccessDialog.account.status === 'ACTIVE' &&
      institutionAccessOptions.some(
        (institution) =>
          institution.id ===
            institutionAccessDialog.selectedInstitutionId &&
          institution.active !== false,
      ),
  );

  useEffect(() => {
    if (institutionAccessDialog) {
      institutionSearchInputRef.current?.focus();
    }
  }, [institutionAccessDialog?.account.id]);

  function clearFilters(): void {
    setSearchTerm('');
    setStatusFilter('ACTIVE');
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
    setInstitutionAccessDialog(null);
    setCloseDialog({
      account,
      confirmation: '',
      reason: '',
      error: null,
    });
  }

  function openPermanentDeleteDialog(
    account: AccountSummaryRow,
  ): void {
    setFeedback(null);
    setInstitutionAccessDialog(null);
    setPermanentDeleteDialog({
      account,
      confirmation: '',
      typedConfirmationLiteral: '',
      understands: false,
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
    setFeedback(null);
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
          'Conta movida para Excluídos. Os dados foram preservados.',
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

  async function handleRestoreAccount(): Promise<void> {
    if (
      !restoreDialogAccount ||
      restoreAccount.isPending
    ) {
      return;
    }

    try {
      await restoreAccount.mutateAsync({
        accountId: restoreDialogAccount.id,
        reason: 'Restauracao pelo super admin.',
      });

      setRestoreDialogAccount(null);
      setFeedback({
        type: 'success',
        message: 'Conta restaurada com sucesso.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: getPlatformErrorMessage(error),
      });
    }
  }

  async function handlePermanentDelete(): Promise<void> {
    if (
      !permanentDeleteDialog ||
      permanentlyDeleteAccount.isPending
    ) {
      return;
    }

    try {
      await permanentlyDeleteAccount.mutateAsync({
        accountId: permanentDeleteDialog.account.id,
        reason: permanentDeleteDialog.reason,
        confirmationEmail:
          permanentDeleteDialog.confirmation,
        confirmationText:
          permanentDeleteDialog.typedConfirmationLiteral,
        acknowledgement:
          permanentDeleteDialog.understands as true,
      });

      setPermanentDeleteDialog(null);
      setFeedback({
        type: 'success',
        message:
          'Conta e dados relacionados foram excluídos definitivamente.',
      });
    } catch (error) {
      setPermanentDeleteDialog((current) =>
        current
          ? {
              ...current,
              error: getPlatformErrorMessage(error),
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
    const previousDialog = institutionAccessDialog;

    try {
      await updateInstitutionStatusMutation.mutateAsync({
        institutionId: institution.id,
        active,
      });

      setInstitutionAccessDialog((current) =>
        current
          ? {
              ...current,
              account: {
                ...current.account,
                institutions: current.account.institutions.map((item) =>
                  item.id === institution.id
                    ? {
                        ...item,
                        active,
                      }
                    : item,
                ),
              },
              error: null,
            }
          : current,
      );

      setFeedback({
        type: 'success',
        message: active
          ? `${institution.name} reativada. Histórico acadêmico preservado.`
          : `${institution.name} suspensa. Histórico acadêmico preservado.`,
      });
    } catch (error) {
      setInstitutionAccessDialog(previousDialog);
      setFeedback({
        type: 'error',
        message: getPlatformErrorMessage(error),
      });
    }
  }

  async function deleteInstitutionFromAccessDialog(
    institution: AccountInstitutionSummary,
  ): Promise<void> {
    if (!institutionAccessDialog) {
      return;
    }

    const confirmed = window.confirm(
      `Excluir definitivamente a instituição "${institution.name}"? Esta ação libera uma licença e remove os dados vinculados a esta escola.`,
    );

    if (!confirmed) {
      return;
    }

    const previousDialog = institutionAccessDialog;

    try {
      await deleteInstitutionMutation.mutateAsync({
        accountId: institutionAccessDialog.account.id,
        institutionId: institution.id,
      });

      setInstitutionAccessDialog((current) => {
        if (!current) {
          return current;
        }

        const institutions =
          current.account.institutions.filter(
            (item) => item.id !== institution.id,
          );

        return {
          ...current,
          account: {
            ...current.account,
            institutions,
          },
          selectedInstitutionId:
            current.selectedInstitutionId === institution.id
              ? institutions[0]?.id ?? ''
              : current.selectedInstitutionId,
          error: null,
        };
      });

      setFeedback({
        type: 'success',
        message: `${institution.name} excluída. A licença foi liberada.`,
      });
    } catch (error) {
      setInstitutionAccessDialog({
        ...previousDialog,
        error: getPlatformErrorMessage(error),
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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_auto] lg:items-end">
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
                  <option value="DELETED">Excluídos</option>
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
              <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                <caption className="sr-only">
                  Contas e instituições da plataforma
                </caption>
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[25%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[17%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead className="bg-[#f3f4f5] text-[11px] uppercase leading-4 text-[#444651]">
                  <tr>
                    <th className="px-3 py-3 font-semibold">
                      Conta
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      ADMIN
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Status
                    </th>
                    <th className="px-3 py-3 text-center font-semibold">
                      Uso
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Limite
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Gerenciar
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
                        className="transition hover:bg-[#f8f9fa] dark:hover:bg-[#1e293b]"
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#dce1ff] text-xs font-bold text-[#00236f] dark:bg-[#1e3a5f] dark:text-[#dbeafe]">
                              {getInitials(account.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#191c1d] dark:text-[#f8fafc]">
                                {account.name}
                              </p>
                              <p className="truncate text-xs text-[#444651] dark:text-[#cbd5e1]">
                                {account.institutions.length} instituições
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-0 px-3 py-4 text-[#444651] dark:text-[#cbd5e1]">
                          <p className="font-medium text-[#191c1d] dark:text-[#f8fafc]">
                            {account.owner
                              ? account.owner.full_name
                              : 'Sem owner'}
                          </p>
                          <p className="text-xs">
                            {account.owner?.email ?? ''}
                          </p>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <StatusBadge status={account.status} />
                        </td>
                        <td className="px-3 py-4 text-center">
                          <div
                            className="mx-auto w-9"
                            aria-label={`Uso de ${account.name}: ${account.activeInstitutionCount} de ${account.institutionLimit}, ${usagePercent}%`}
                          >
                            <span className="block text-xs font-semibold text-[#444651] dark:text-[#cbd5e1]">
                              {account.activeInstitutionCount}/
                              {account.institutionLimit}
                            </span>
                            <div className="mx-auto mt-1.5 h-1 w-8 rounded-full bg-[#edeeef] dark:bg-[#334155]">
                              <div
                                className="h-1 rounded-full bg-[#006c49]"
                                style={{
                                  width: `${usagePercent}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
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
                              className="h-9 w-16 rounded-lg border border-[#c5c5d3] px-2 text-sm outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5] disabled:text-[#757682] dark:border-[#475569] dark:bg-[#0f172a] dark:text-[#f8fafc] dark:caret-[#f8fafc] dark:disabled:bg-[#111827] dark:disabled:text-[#64748b]"
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
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#1e3a8a] transition hover:bg-[#dce1ff] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#475569] dark:text-[#93c5fd] dark:hover:bg-[#1e3a5f]"
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
                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              void openInstitutionAccessDialog(
                                account,
                              )
                            }
                            disabled={!account.owner}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-3 text-xs font-semibold text-[#1e3a8a] transition hover:bg-[#dce1ff] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#475569] dark:bg-[#182235] dark:text-[#93c5fd] dark:hover:bg-[#243247]"
                            aria-label={`Gerenciar escolas e ações de ${account.name}`}
                          >
                            <Building2
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                            Gerenciar
                          </button>
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
                      Escolas e ações
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
                    Nenhuma escola cadastrada nesta conta.
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
                              <div
                                key={institution.id}
                                className="flex items-center gap-2 rounded-md p-1"
                              >
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  onClick={() =>
                                    selectInstitutionAccessOption(
                                      institution.id,
                                    )
                                  }
                                  disabled={
                                    isAccessingInstitution ||
                                    institution.active === false
                                  }
                                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#005bbf] disabled:cursor-not-allowed disabled:opacity-70 ${
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
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold">
                                      {institution.name}
                                    </span>
                                    <span
                                      className={`block text-xs font-semibold ${
                                        institution.active ===
                                        false
                                          ? 'text-[#7a4d00] dark:text-[#ffb95f]'
                                          : 'text-[#005236] dark:text-[#6ffbbe]'
                                      }`}
                                    >
                                      {institution.active ===
                                      false
                                        ? 'Suspensa'
                                        : 'Ativa'}
                                    </span>
                                  </span>
                                </button>

                                {institutionAccessDialog.account
                                  .status === 'ACTIVE' && (
                                  <>
                                    <IconActionButton
                                      label={`${institution.active === false ? 'Reativar' : 'Suspender'} ${institution.name}`}
                                      onClick={() =>
                                        void changeInstitutionStatus(
                                          institution,
                                          institution.active ===
                                            false,
                                        )
                                      }
                                      disabled={
                                        updateInstitutionStatusMutation.isPending
                                      }
                                      className={
                                        institution.active ===
                                        false
                                          ? 'border-[#6ffbbe] text-[#005236] hover:bg-[#effdf6] focus:ring-[#6ffbbe]/50 dark:border-[#059669] dark:text-[#6ffbbe] dark:hover:bg-[#022c22]/60'
                                          : 'border-[#ffb95f] text-[#7a4d00] hover:bg-[#fff4ce] focus:ring-[#ffb95f]/40 dark:border-[#b45309] dark:text-[#ffb95f] dark:hover:bg-[#451a03]/60'
                                      }
                                    >
                                      {institution.active === false ? (
                                        <CheckCircle2
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <PauseCircle
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </IconActionButton>
                                    <IconActionButton
                                      label={`Excluir ${institution.name}`}
                                      onClick={() =>
                                        void deleteInstitutionFromAccessDialog(
                                          institution,
                                        )
                                      }
                                      disabled={
                                        deleteInstitutionMutation.isPending
                                      }
                                      className="border-[#ffdad6] text-[#93000a] hover:bg-[#fff1ef] focus:ring-[#ffdad6]/70 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/40"
                                    >
                                      <Trash2
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                      />
                                    </IconActionButton>
                                  </>
                                )}
                              </div>
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

                <div className="mt-4 rounded-lg border border-[#c5c5d3]/70 p-4 dark:border-[#334155]">
                  <h3 className="text-sm font-semibold text-[#191c1d] dark:text-[#f8fafc]">
                    Opções de ação
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {institutionAccessDialog.account.status ===
                    'ACTIVE' ? (
                      <IconActionButton
                        label={`Suspender ${institutionAccessDialog.account.name}`}
                        onClick={() =>
                          void updateStatus(
                            institutionAccessDialog.account.id,
                            'SUSPENDED',
                          )
                        }
                        disabled={updateAccount.isPending}
                        className="border-[#ffb95f] text-[#7a4d00] hover:bg-[#fff4ce] focus:ring-[#ffb95f]/40 dark:border-[#b45309] dark:text-[#ffb95f] dark:hover:bg-[#451a03]/60"
                      >
                        <PauseCircle
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </IconActionButton>
                    ) : institutionAccessDialog.account.status ===
                      'SUSPENDED' ? (
                      <IconActionButton
                        label={`Reativar ${institutionAccessDialog.account.name}`}
                        onClick={() =>
                          void updateStatus(
                            institutionAccessDialog.account.id,
                            'ACTIVE',
                          )
                        }
                        disabled={updateAccount.isPending}
                        className="border-[#6ffbbe] text-[#005236] hover:bg-[#effdf6] focus:ring-[#6ffbbe]/50 dark:border-[#059669] dark:text-[#6ffbbe] dark:hover:bg-[#022c22]/60"
                      >
                        <CheckCircle2
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </IconActionButton>
                    ) : null}

                    <IconActionButton
                      label={`Ver histórico de ${institutionAccessDialog.account.name}`}
                      onClick={() => {
                        setInstitutionAccessDialog(null);
                        setStatusHistoryDialog({
                          account: institutionAccessDialog.account,
                        });
                      }}
                      className="border-[#c5c5d3] text-[#444651] hover:bg-[#f3f4f5] focus:ring-[#1e3a8a]/30 dark:border-[#475569] dark:text-[#cbd5e1] dark:hover:bg-[#243247]"
                    >
                      <History
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </IconActionButton>

                    {institutionAccessDialog.account.status !==
                      'CANCELED' &&
                      canCloseAccounts &&
                      institutionAccessDialog.account.owner
                        ?.email && (
                        <IconActionButton
                          label={`Excluir conta ${institutionAccessDialog.account.name}`}
                          onClick={() =>
                            openCloseDialog(
                              institutionAccessDialog.account,
                            )
                          }
                          disabled={closeAccount.isPending}
                          className="border-[#ffdad6] text-[#93000a] hover:bg-[#fff1ef] focus:ring-[#ffdad6]/70 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/40"
                        >
                          <X
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </IconActionButton>
                      )}

                    {institutionAccessDialog.account.status ===
                      'CANCELED' &&
                      canCloseAccounts && (
                        <>
                          <IconActionButton
                            label={`Restaurar ${institutionAccessDialog.account.name}`}
                            onClick={() => {
                              setInstitutionAccessDialog(null);
                              setRestoreDialogAccount(
                                institutionAccessDialog.account,
                              );
                            }}
                            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-300/50 active:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950 dark:active:bg-emerald-900"
                          >
                            <RotateCcw
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </IconActionButton>
                          <IconActionButton
                            label={`Excluir permanentemente ${institutionAccessDialog.account.name}`}
                            onClick={() =>
                              openPermanentDeleteDialog(
                                institutionAccessDialog.account,
                              )
                            }
                            className="border-red-300 text-red-700 hover:bg-red-50 focus:ring-red-300/50 active:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:active:bg-red-900"
                          >
                            <Trash2
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </IconActionButton>
                        </>
                      )}
                  </div>
                </div>

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
                    Excluir conta
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#444651]">
                    A conta será movida para Excluídos. Dados
                    acadêmicos, instituições, perfis e
                    histórico serão preservados.
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
                  A conta será movida para Excluídos. Todos os
                  dados permanecem preservados e podem ser
                  restaurados posteriormente.
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
                  Motivo da exclusão
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
                  Excluir conta
                </button>
              </div>
            </section>
          </div>
        )}

        {restoreDialogAccount && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="restore-account-title"
              className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="restore-account-title"
                    className="text-xl font-semibold leading-7 text-[#191c1d]"
                  >
                    Restaurar conta
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#444651]">
                    {restoreDialogAccount.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRestoreDialogAccount(null)
                  }
                  disabled={restoreAccount.isPending}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Fechar restauracao"
                >
                  <X
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-[#6ffbbe] bg-[#effdf6] p-4 text-sm leading-5 text-[#005236]">
                <p>
                  Restaurar esta conta e permitir novamente o
                  acesso operacional? Todos os dados anteriores
                  serão preservados.
                </p>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setRestoreDialogAccount(null)
                  }
                  disabled={restoreAccount.isPending}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleRestoreAccount()
                  }
                  disabled={restoreAccount.isPending}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#006c49] px-4 text-sm font-semibold text-white transition hover:bg-[#005236] focus:outline-none focus:ring-2 focus:ring-[#006c49]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoreAccount.isPending ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RotateCcw
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  Restaurar
                </button>
              </div>
            </section>
          </div>
        )}

        {permanentDeleteDialog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
            role="presentation"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="permanent-delete-title"
              className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2
                    id="permanent-delete-title"
                    className="text-xl font-semibold leading-7 text-[#191c1d]"
                  >
                    Excluir permanentemente
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#444651]">
                    {permanentDeleteDialog.account.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPermanentDeleteDialog(null)
                  }
                  disabled={
                    permanentlyDeleteAccount.isPending
                  }
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c5c5d3] text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Fechar exclusao permanente"
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
                    {permanentDeleteDialog.account.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#757682]">
                    Administrador
                  </p>
                  <p className="mt-1 font-semibold text-[#191c1d]">
                    {permanentDeleteDialog.account.owner
                      ?.full_name ?? 'Sem owner'}
                  </p>
                  <p>
                    {permanentDeleteDialog.account.owner
                      ?.email ?? ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-3 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-4 text-sm leading-5 text-[#93000a]">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  Esta operação removerá todos os dados
                  relacionados à conta de forma irreversível.
                  Não será possível recuperar nenhuma
                  informação após a confirmação.
                </p>
              </div>

              {permanentDeleteDialog.error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-[#ffdad6] bg-[#fff1ef] p-3 text-sm text-[#93000a]"
                >
                  {permanentDeleteDialog.error}
                </div>
              )}

              <div className="mt-4">
                <label
                  htmlFor="permanent-delete-reason"
                  className="block text-xs font-semibold text-[#444651]"
                >
                  Motivo da exclusão permanente
                </label>
                <textarea
                  id="permanent-delete-reason"
                  value={permanentDeleteDialog.reason}
                  onChange={(event) =>
                    setPermanentDeleteDialog((current) =>
                      current
                        ? {
                            ...current,
                            reason:
                              event.target.value,
                            error: null,
                          }
                        : current,
                    )
                  }
                  minLength={10}
                  maxLength={500}
                  disabled={
                    permanentlyDeleteAccount.isPending
                  }
                  className="mt-1 min-h-24 w-full rounded-lg border border-[#c5c5d3] px-3 py-2 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5]"
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="permanent-delete-confirmation"
                  className="block text-xs font-semibold text-[#444651]"
                >
                  Digite o e-mail do administrador para
                  confirmar
                </label>
                <input
                  id="permanent-delete-confirmation"
                  type="email"
                  value={
                    permanentDeleteDialog.confirmation
                  }
                  onChange={(event) =>
                    setPermanentDeleteDialog((current) =>
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
                  disabled={
                    permanentlyDeleteAccount.isPending
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5]"
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="permanent-delete-literal"
                  className="block text-xs font-semibold text-[#444651]"
                >
                  Digite{' '}
                  <span className="font-bold tracking-wider">
                    EXCLUIR DEFINITIVAMENTE
                  </span>{' '}
                  para confirmar
                </label>
                <input
                  id="permanent-delete-literal"
                  type="text"
                  value={
                    permanentDeleteDialog
                      .typedConfirmationLiteral
                  }
                  onChange={(event) =>
                    setPermanentDeleteDialog((current) =>
                      current
                        ? {
                            ...current,
                            typedConfirmationLiteral:
                              event.target.value,
                            error: null,
                          }
                        : current,
                    )
                  }
                  disabled={
                    permanentlyDeleteAccount.isPending
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#f3f4f5]"
                />
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={
                    permanentDeleteDialog.understands
                  }
                  onChange={(event) =>
                    setPermanentDeleteDialog(
                      (current) =>
                        current
                          ? {
                              ...current,
                              understands:
                                event.target.checked,
                              error: null,
                            }
                          : current,
                    )
                  }
                  disabled={
                    permanentlyDeleteAccount.isPending
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[#c5c5d3] text-[#93000a] focus:ring-[#93000a]/30"
                />
                <span className="text-sm leading-5 text-[#444651]">
                  Entendo que esta operação não poderá ser
                  desfeita.
                </span>
              </label>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setPermanentDeleteDialog(null)
                  }
                  disabled={
                    permanentlyDeleteAccount.isPending
                  }
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#c5c5d3] bg-white px-4 text-sm font-semibold text-[#444651] transition hover:bg-[#f3f4f5] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handlePermanentDelete()
                  }
                  disabled={
                    !permanentDeleteCanSubmit ||
                    permanentlyDeleteAccount.isPending
                  }
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#93000a] px-4 text-sm font-semibold text-white transition hover:bg-[#730006] focus:outline-none focus:ring-2 focus:ring-[#93000a]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {permanentlyDeleteAccount.isPending ? (
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
                  Excluir permanentemente
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

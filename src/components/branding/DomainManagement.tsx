import {
  CheckCircle2,
  Globe2,
  Loader2,
  PauseCircle,
  Send,
} from 'lucide-react';
import {
  useState,
  type FormEvent,
} from 'react';

import type {
  AccountDomain,
  AccountDomainStatus,
} from '../../services/brandingService';

const statusLabels: Record<AccountDomainStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
  DISABLED: 'Desativado',
};

const statusClasses: Record<AccountDomainStatus, string> = {
  PENDING: 'bg-[#fff4ce] text-[#7a4d00]',
  ACTIVE: 'bg-[#e6f4ea] text-[#0f6d3a]',
  DISABLED: 'bg-[#ffdad6] text-[#93000a]',
};

function DomainStatusBadge({
  status,
}: {
  status: AccountDomainStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function formatDate(value: string): string {
  if (!value) {
    return '-';
  }

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AccountDomainSection({
  domains,
  isLoading,
  isRequesting,
  onRequestDomain,
}: {
  domains: AccountDomain[];
  isLoading: boolean;
  isRequesting: boolean;
  onRequestDomain: (hostname: string) => Promise<void>;
}) {
  const [hostname, setHostname] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFeedback(null);

    try {
      await onRequestDomain(hostname);
      setHostname('');
      setFeedback({
        type: 'success',
        message: 'Hostname solicitado.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel solicitar o hostname.',
      });
    }
  }

  return (
    <section className="rounded-lg border border-[#d8deea] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Globe2
          className="h-5 w-5 text-[#005bbf]"
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-[#181c20]">
          Dominios da conta
        </h2>
      </div>

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="mt-4 flex flex-col gap-3 md:flex-row"
      >
        <input
          aria-label="Hostname da conta"
          value={hostname}
          onChange={(event) =>
            setHostname(event.target.value)
          }
          placeholder="escola.exemplo.com"
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#c5c5d3] px-3 text-sm outline-none transition focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
        />
        <button
          type="submit"
          disabled={isRequesting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 text-sm font-semibold text-white transition hover:bg-[#004a9f] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isRequesting ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Send
              className="h-4 w-4"
              aria-hidden="true"
            />
          )}
          Solicitar hostname
        </button>
      </form>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-lg border p-3 text-sm ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        {isLoading ? (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-[#667085]"
          >
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Carregando dominios...
          </div>
        ) : domains.length === 0 ? (
          <p className="text-sm text-[#667085]">
            Nenhum dominio solicitado.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e4e8f1] text-xs uppercase text-[#667085]">
                <th className="py-2 pr-4 font-bold">Hostname</th>
                <th className="py-2 pr-4 font-bold">Status</th>
                <th className="py-2 pr-4 font-bold">Tipo</th>
                <th className="py-2 font-bold">Solicitado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e8f1]">
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td className="py-3 pr-4 font-semibold text-[#181c20]">
                    {domain.hostname}
                  </td>
                  <td className="py-3 pr-4">
                    <DomainStatusBadge status={domain.status} />
                  </td>
                  <td className="py-3 pr-4 text-[#667085]">
                    {domain.isPrimary ? 'Principal' : 'Secundario'}
                  </td>
                  <td className="py-3 text-[#667085]">
                    {formatDate(domain.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export function PlatformDomainRequestsSection({
  domains,
  isLoading,
  isMutating,
  onActivate,
  onDisable,
}: {
  domains: AccountDomain[];
  isLoading: boolean;
  isMutating: boolean;
  onActivate: (domainId: string) => Promise<void>;
  onDisable: (domainId: string) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function runAction(
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<void> {
    setFeedback(null);

    try {
      await action();
      setFeedback({
        type: 'success',
        message: successMessage,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Nao foi possivel atualizar o dominio.',
      });
    }
  }

  return (
    <section className="rounded-lg border border-[#d8deea] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Globe2
            className="h-5 w-5 text-[#005bbf]"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold text-[#181c20]">
            Solicitacoes de dominio
          </h2>
        </div>
        <p className="text-sm leading-6 text-[#667085]">
          A ativacao interna nao configura automaticamente o DNS nem o dominio personalizado no Cloudflare. Cadastrar dominio no banco nao cria DNS automaticamente.
        </p>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-lg border p-3 text-sm ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        {isLoading ? (
          <div
            role="status"
            className="flex items-center gap-2 text-sm text-[#667085]"
          >
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Carregando solicitacoes...
          </div>
        ) : domains.length === 0 ? (
          <p className="text-sm text-[#667085]">
            Nenhuma solicitacao de dominio.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e4e8f1] text-xs uppercase text-[#667085]">
                <th className="py-2 pr-4 font-bold">Hostname</th>
                <th className="py-2 pr-4 font-bold">Conta</th>
                <th className="py-2 pr-4 font-bold">Status</th>
                <th className="py-2 pr-4 font-bold">Solicitado em</th>
                <th className="py-2 pr-4 font-bold">Tipo</th>
                <th className="py-2 font-bold">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e8f1]">
              {domains.map((domain) => (
                <tr key={domain.id}>
                  <td className="py-3 pr-4 font-semibold text-[#181c20]">
                    {domain.hostname}
                  </td>
                  <td className="py-3 pr-4 text-[#414754]">
                    {domain.accountName ?? domain.accountId}
                  </td>
                  <td className="py-3 pr-4">
                    <DomainStatusBadge status={domain.status} />
                  </td>
                  <td className="py-3 pr-4 text-[#667085]">
                    {formatDate(domain.createdAt)}
                  </td>
                  <td className="py-3 pr-4 text-[#667085]">
                    {domain.isPrimary ? 'Principal' : 'Secundario'}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          isMutating ||
                          domain.status === 'ACTIVE'
                        }
                        onClick={() => {
                          void runAction(
                            () => onActivate(domain.id),
                            'Dominio ativado.',
                          );
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 text-xs font-bold text-green-800 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Ativar
                      </button>
                      <button
                        type="button"
                        disabled={
                          isMutating ||
                          domain.status === 'DISABLED'
                        }
                        onClick={() => {
                          void runAction(
                            () => onDisable(domain.id),
                            'Dominio desativado.',
                          );
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-[#ba1a1a] transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PauseCircle
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        Desativar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

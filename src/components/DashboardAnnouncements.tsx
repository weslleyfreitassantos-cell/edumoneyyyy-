import {
  AlertTriangle,
  Bell,
  Megaphone,
} from 'lucide-react';

import type { InstitutionAnnouncement } from '../services/announcementService';
import type { RegistrationCompletion } from '../services/registrationCompletionService';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export default function DashboardAnnouncements({
  announcements,
  registration,
  isLoading,
  isError,
  role,
  onRetry,
}: {
  announcements: InstitutionAnnouncement[];
  registration?: RegistrationCompletion;
  isLoading?: boolean;
  isError?: boolean;
  role: 'student' | 'guardian';
  onRetry?: () => void;
}) {
  const pendingItems = registration?.pendingItems ?? [];

  return (
    <section
      aria-labelledby="dashboard-announcements-title"
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
        <h2 id="dashboard-announcements-title" className="text-lg font-bold text-[#181c20]">
          Avisos
        </h2>
      </div>

      {pendingItems.length > 0 && (
        <article role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="font-bold">Cadastro com pendências</h3>
              <p className="mt-1 text-sm text-amber-800">
                Atualize os itens pendentes do cadastro.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {pendingItems.map((item) => (
                  <li key={item.id}>
                    <strong>{item.label}:</strong> {item.description}
                  </li>
                ))}
              </ul>
              {(role === 'student' || role === 'guardian') && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('open-self-registration'))}
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#005bbf] px-4 text-sm font-bold text-white outline-none transition hover:bg-[#004a9f] focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2"
                >
                  Atualizar meu cadastro
                </button>
              )}
            </div>
          </div>
        </article>
      )}

      {isLoading ? (
        <div role="status" aria-label="Carregando avisos" className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-6 text-sm text-[#727785]">
          Carregando avisos...
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>Os avisos da instituição estão temporariamente indisponíveis.</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">
              Tentar novamente
            </button>
          )}
        </div>
      ) : announcements.length === 0 ? (
        <div role="status" className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-6 text-sm text-[#727785]">
          Nenhum aviso publicado no momento.
        </div>
      ) : (
        <div
          role="region"
          aria-label="Avisos publicados. Deslize horizontalmente para consultar outros avisos."
          tabIndex={0}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#005bbf] sm:grid sm:grid-cols-2 sm:overflow-visible sm:snap-none lg:grid-cols-2"
        >
          {announcements.map((announcement) => (
            <article key={announcement.id} className="w-[min(88vw,24rem)] flex-none snap-start rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm sm:w-auto sm:min-w-0">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]">
                  <Megaphone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
                    Publicado em {formatDate(announcement.starts_at)}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[#181c20]">{announcement.title}</h3>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#414754]">
                {announcement.message}
              </p>
            </article>
          ))}
        </div>
      )}

      <span className="sr-only">Painel de avisos para {role === 'student' ? 'aluno' : 'responsável'}.</span>
    </section>
  );
}

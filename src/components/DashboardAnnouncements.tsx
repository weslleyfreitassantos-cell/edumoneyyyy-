import {
  AlertTriangle,
  Bell,
  CheckCircle2,
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
}: {
  announcements: InstitutionAnnouncement[];
  registration?: RegistrationCompletion;
  isLoading?: boolean;
  isError?: boolean;
  role: 'student' | 'guardian';
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
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="font-bold">Cadastro com pendências</h3>
              <p className="mt-1 text-sm text-amber-800">
                Finalize os itens abaixo para manter os dados atualizados.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {pendingItems.map((item) => (
                  <li key={item.id}>
                    <strong>{item.label}:</strong> {item.description}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-amber-800">
                Para concluir os itens acadêmicos, procure a secretaria da escola.
              </p>
            </div>
          </div>
        </article>
      )}

      {registration && pendingItems.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Seu cadastro está sem pendências obrigatórias.</span>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-6 text-sm text-[#727785]">
          Carregando avisos...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-[#727785]">
          Os avisos da instituição estão temporariamente indisponíveis.
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#c1c6d6] bg-white p-6 text-sm text-[#727785]">
          Nenhum aviso publicado no momento.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
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

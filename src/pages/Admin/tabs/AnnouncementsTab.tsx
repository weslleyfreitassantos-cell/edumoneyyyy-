import { useState, type FormEvent } from 'react';
import {
  Archive,
  Bell,
  Megaphone,
  Plus,
  Trash2,
} from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import {
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useInstitutionAnnouncements,
  useSetAnnouncementActive,
} from '../../../hooks/useAnnouncements';
import {
  ANNOUNCEMENT_AUDIENCES,
  type AnnouncementAudience,
} from '../../../services/announcementService';

interface AnnouncementDraft {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  starts_at: string;
  ends_at: string;
}

function toDateTimeLocal(value: Date): string {
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

const emptyDraft = (): AnnouncementDraft => ({
  title: '',
  message: '',
  audience: 'ALL',
  starts_at: toDateTimeLocal(new Date()),
  ends_at: '',
});

const audienceLabels: Record<AnnouncementAudience, string> = {
  ALL: 'Todos os alunos e responsáveis',
  STUDENTS: 'Somente alunos',
  GUARDIANS: 'Somente responsáveis',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir a operação.';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function AnnouncementsTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const announcementsQuery = useInstitutionAnnouncements(institutionId);
  const createMutation = useCreateAnnouncement(institutionId);
  const activeMutation = useSetAnnouncementActive(institutionId);
  const deleteMutation = useDeleteAnnouncement(institutionId);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFeedback(null);

    if (!profile || !institutionId) {
      setFormError('A instituição atual não foi encontrada.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        institution_id: institutionId,
        created_by: profile.id,
        title: draft.title,
        message: draft.message,
        audience: draft.audience,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at || null,
      });
      setDraft(emptyDraft());
      setFeedback('Aviso publicado com sucesso.');
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setFormError(null);
    try {
      await activeMutation.mutateAsync({ id, active });
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  async function removeAnnouncement(id: string) {
    if (!window.confirm('Excluir este aviso?')) return;
    setFormError(null);
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  }

  if (institutionQuery.isLoading || announcementsQuery.isLoading) {
    return <div className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-[#667085]">Carregando avisos...</div>;
  }

  if (institutionQuery.isError || announcementsQuery.isError) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{getErrorMessage(institutionQuery.error ?? announcementsQuery.error)}</div>;
  }

  const announcements = announcementsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#667085]">Comunicação</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#181c20]">Avisos da escola</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#667085]">Publique comunicados para os alunos, responsáveis ou para os dois públicos.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-[#005bbf]"><Bell className="h-5 w-5" aria-hidden="true" /></div>
      </header>

      {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{formError}</div>}
      {feedback && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{feedback}</div>}

      <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-[#181c20]">Novo aviso</h2>
        </div>
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="text-sm font-bold text-[#414754]">Título
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={160} required className="mt-2 w-full rounded-lg border border-[#cfd6e2] px-3 py-2.5 font-normal outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20" placeholder="Ex.: Reunião de responsáveis" />
          </label>
          <label className="text-sm font-bold text-[#414754]">Mensagem
            <textarea value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} maxLength={12000} rows={5} required className="mt-2 w-full resize-y rounded-lg border border-[#cfd6e2] px-3 py-2.5 font-normal outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20" placeholder="Escreva o comunicado da escola" />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold text-[#414754]">Público
              <select value={draft.audience} onChange={(event) => setDraft((current) => ({ ...current, audience: event.target.value as AnnouncementAudience }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20">
                {ANNOUNCEMENT_AUDIENCES.map((audience) => <option key={audience} value={audience}>{audienceLabels[audience]}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-[#414754]">Publicar em
              <input type="datetime-local" value={draft.starts_at} onChange={(event) => setDraft((current) => ({ ...current, starts_at: event.target.value }))} required className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20" />
            </label>
            <label className="text-sm font-bold text-[#414754]">Encerrar em <span className="font-normal text-[#667085]">(opcional)</span>
              <input type="datetime-local" value={draft.ends_at} onChange={(event) => setDraft((current) => ({ ...current, ends_at: event.target.value }))} className="mt-2 w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20" />
            </label>
          </div>
          <div><button type="submit" disabled={createMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004a9b] disabled:cursor-not-allowed disabled:opacity-50"><Megaphone className="h-4 w-4" aria-hidden="true" />{createMutation.isPending ? 'Publicando...' : 'Publicar aviso'}</button></div>
        </form>
      </section>

      <section className="rounded-xl border border-[#dfe3e8] bg-white shadow-sm">
        <div className="border-b border-[#dfe3e8] p-5"><h2 className="font-extrabold text-[#181c20]">Avisos cadastrados</h2><p className="mt-1 text-sm text-[#667085]">Avisos inativos continuam disponíveis para consulta e podem ser reativados.</p></div>
        {announcements.length === 0 ? <p className="p-8 text-center text-sm text-[#667085]">Nenhum aviso cadastrado.</p> : <div className="divide-y divide-[#dfe3e8]">{announcements.map((announcement) => <article key={announcement.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#181c20]">{announcement.title}</h3><span className={announcement.active ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600'}>{announcement.active ? 'Ativo' : 'Inativo'}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-[#414754]">{announcement.message}</p><p className="mt-3 text-xs text-[#667085]">{audienceLabels[announcement.audience]} · início {formatDate(announcement.starts_at)}{announcement.ends_at ? ` · fim ${formatDate(announcement.ends_at)}` : ''}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => void toggleActive(announcement.id, !announcement.active)} disabled={activeMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-[#cfd6e2] px-3 py-2 text-sm font-bold text-[#414754] hover:bg-[#f8fafc] disabled:opacity-50"><Archive className="h-4 w-4" aria-hidden="true" />{announcement.active ? 'Desativar' : 'Ativar'}</button><button type="button" onClick={() => void removeAnnouncement(announcement.id)} disabled={deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" />Excluir</button></div></article>)}</div>}
      </section>
    </div>
  );
}

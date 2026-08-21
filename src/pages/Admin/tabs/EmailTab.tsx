import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  Eye,
  Mail,
  Palette,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import {
  SCHOOL_EMAIL_AUDIENCES,
  schoolEmailService,
  type SchoolEmailAudience,
  type SchoolEmailContent,
  type SchoolEmailPreview,
  type SchoolEmailRecipient,
} from '../../../services/schoolEmailService';

const DEFAULT_PRIMARY_COLOR = '#005bbf';
const DEFAULT_SECONDARY_COLOR = '#6ffbbe';

const audienceLabels: Record<SchoolEmailAudience, string> = {
  STUDENTS: 'Todos os alunos',
  GUARDIANS: 'Todos os responsáveis',
  STUDENTS_AND_GUARDIANS: 'Alunos e responsáveis',
  TEACHERS: 'Todos os professores',
  STUDENTS_GUARDIANS_AND_TEACHERS: 'Alunos, responsáveis e professores',
  SELECTED: 'Pessoas específicas',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Não foi possível concluir o envio.';
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function uniqueByEmail(
  recipients: SchoolEmailRecipient[],
): SchoolEmailRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    const key = recipient.email?.trim().toLocaleLowerCase('pt-BR') || recipient.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAudienceRecipients(
  recipients: SchoolEmailRecipient[],
  audience: SchoolEmailAudience,
  selectedRecipientIds: string[],
): SchoolEmailRecipient[] {
  if (audience === 'SELECTED') {
    const selected = new Set(selectedRecipientIds);
    return uniqueByEmail(
      recipients.filter((recipient) => selected.has(recipient.id)),
    );
  }

  if (audience === 'STUDENTS') {
    return recipients.filter((recipient) => recipient.kind === 'STUDENT');
  }

  if (audience === 'GUARDIANS') {
    return recipients.filter((recipient) => recipient.kind === 'GUARDIAN');
  }

  if (audience === 'TEACHERS') {
    return recipients.filter((recipient) => recipient.kind === 'TEACHER');
  }

  if (audience === 'STUDENTS_AND_GUARDIANS') {
    return uniqueByEmail(
      recipients.filter((recipient) =>
        recipient.kind === 'STUDENT' || recipient.kind === 'GUARDIAN',
      ),
    );
  }

  return uniqueByEmail(recipients);
}

export default function EmailTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const institution = institutionQuery.institution;

  const [recipients, setRecipients] = useState<SchoolEmailRecipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [audience, setAudience] = useState<SchoolEmailAudience>(
    'STUDENTS_AND_GUARDIANS',
  );
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SchoolEmailPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!institutionId) {
      setRecipients([]);
      return;
    }

    let active = true;
    const cachedRecipients = schoolEmailService.getCachedRecipients?.(institutionId) ?? null;

    if (cachedRecipients) {
      setRecipients(cachedRecipients);
      setIsLoadingRecipients(false);
    } else {
      setIsLoadingRecipients(true);
    }
    setRecipientError(null);

    schoolEmailService.listRecipients(institutionId)
      .then((data) => {
        if (active) setRecipients(data);
      })
      .catch((error: unknown) => {
        if (active) setRecipientError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoadingRecipients(false);
      });

    return () => {
      active = false;
    };
  }, [institutionId]);

  useEffect(() => {
    setPrimaryColor(institution?.primary_color || DEFAULT_PRIMARY_COLOR);
    setSecondaryColor(institution?.secondary_color || DEFAULT_SECONDARY_COLOR);
  }, [institution?.primary_color, institution?.secondary_color]);

  const audienceRecipients = useMemo(
    () => getAudienceRecipients(recipients, audience, selectedRecipientIds),
    [audience, recipients, selectedRecipientIds],
  );

  const normalizedSearch = normalizeSearch(search);
  const filteredRecipients = useMemo(
    () => recipients.filter((recipient) => {
      if (!normalizedSearch) return true;
      return [recipient.name, recipient.email ?? '']
        .some((value) => normalizeSearch(value).includes(normalizedSearch));
    }),
    [normalizedSearch, recipients],
  );

  function toggleRecipient(recipientId: string): void {
    setSelectedRecipientIds((current) =>
      current.includes(recipientId)
        ? current.filter((id) => id !== recipientId)
        : [...current, recipientId],
    );
    setPreview(null);
  }

  function buildContent(): SchoolEmailContent | null {
    if (!institutionId) {
      setFormError('Selecione uma instituição ativa antes de enviar.');
      return null;
    }
    if (!subject.trim()) {
      setFormError('Informe o assunto do e-mail.');
      return null;
    }
    if (!message.trim()) {
      setFormError('Informe a mensagem.');
      return null;
    }
    if (audienceRecipients.length === 0) {
      setFormError('Nenhum destinatário foi encontrado para este envio.');
      return null;
    }

    return {
      institutionId,
      audience,
      selectedRecipientIds: audience === 'SELECTED'
        ? selectedRecipientIds
        : undefined,
      subject: subject.trim(),
      title: title.trim() || undefined,
      message: message.trim(),
      primaryColor,
      secondaryColor,
    };
  }

  async function handlePreview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    const content = buildContent();
    if (!content) return;

    setIsPreviewing(true);
    try {
      setPreview(await schoolEmailService.preview(content));
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleSend(): Promise<void> {
    if (!preview) return;
    const content = buildContent();
    if (!content) return;

    setIsSending(true);
    setFormError(null);
    try {
      const result = await schoolEmailService.send(content);
      setPreview(null);
      setSuccessMessage(
        `${result.sentCount} e-mail(s) enviado(s). ${result.recipientsWithoutEmail} destinatário(s) sem e-mail foram ignorados.`,
      );
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  if (institutionQuery.isLoading || isLoadingRecipients) {
    return (
      <section className="rounded-xl border border-[#dfe3e8] bg-white p-6 text-sm text-[#667085]">
        Carregando destinatários...
      </section>
    );
  }

  if (institutionQuery.isError || recipientError) {
    return (
      <section role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {recipientError || getErrorMessage(institutionQuery.error)}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#667085]">Comunicação</p>
          <h1 className="mt-2 text-2xl font-extrabold text-[#181c20]">E-mail institucional</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#667085]">
            Envie um comunicado para pessoas vinculadas a {institution?.name ?? 'esta instituição'}.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#eef4ff] px-3 py-2 text-sm font-semibold text-[#005bbf]">
          <Mail className="h-4 w-4" aria-hidden="true" />
          {audienceRecipients.length} destinatário(s)
        </div>
      </header>

      {formError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}
      {successMessage ? (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <form className="space-y-6" onSubmit={handlePreview}>
        <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UsersIcon />
            <h2 className="text-base font-extrabold text-[#181c20]">Destinatários</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {SCHOOL_EMAIL_AUDIENCES.map((option) => (
              <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${audience === option ? 'border-[#005bbf] bg-[#eef4ff]' : 'border-[#dfe3e8] hover:bg-[#f8fafc]'}`}>
                <input
                  type="radio"
                  name="email-audience"
                  value={option}
                  checked={audience === option}
                  onChange={() => {
                    setAudience(option);
                    setPreview(null);
                  }}
                  className="mt-0.5 h-4 w-4 accent-[#005bbf]"
                />
                <span className="font-semibold text-[#414754]">{audienceLabels[option]}</span>
              </label>
            ))}
          </div>

          {audience === 'SELECTED' ? (
            <div className="mt-5">
              <label htmlFor="email-recipient-search" className="text-sm font-bold text-[#414754]">Buscar pessoa</label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
                <input
                  id="email-recipient-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome ou e-mail"
                  className="w-full rounded-lg border border-[#cfd6e2] bg-white py-2.5 pl-9 pr-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20"
                />
              </div>
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[#dfe3e8]" role="listbox" aria-label="Pessoas específicas">
                {filteredRecipients.length === 0 ? (
                  <p className="p-4 text-sm text-[#667085]">Nenhuma pessoa encontrada.</p>
                ) : filteredRecipients.map((recipient) => (
                  <label key={recipient.id} className="flex cursor-pointer items-start gap-3 border-b border-[#eef1f5] p-3 last:border-b-0 hover:bg-[#f8fafc]">
                    <input
                      type="checkbox"
                      checked={selectedRecipientIds.includes(recipient.id)}
                      onChange={() => toggleRecipient(recipient.id)}
                      className="mt-0.5 h-4 w-4 accent-[#005bbf]"
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-semibold text-[#181c20]">{recipient.name}</span>
                      <span className="block truncate text-[#667085]">{recipient.email || 'Sem e-mail'}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-sm text-[#667085]">
            {audienceRecipients.length} destinatário(s) encontrado(s). Pessoas sem e-mail serão ignoradas.
          </p>
        </section>

        <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#181c20]">Mensagem</h2>
          </div>
          <div className="mt-4 grid gap-4">
            <Field label="Assunto *" htmlFor="school-email-subject">
              <input id="school-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} required className={inputClass} />
            </Field>
            <Field label="Título" htmlFor="school-email-title">
              <input id="school-email-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={inputClass} />
            </Field>
            <Field label="Mensagem *" htmlFor="school-email-message">
              <textarea id="school-email-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={12000} rows={8} required className={`${inputClass} resize-y`} />
            </Field>
            <p className="text-xs text-[#667085]">Tokens disponíveis: <code>{'{{nome}}'}</code> e <code>{'{{escola}}'}</code>. O conteúdo é tratado como texto seguro.</p>
          </div>
        </section>

        <section className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <PaletteIcon />
            <h2 className="text-base font-extrabold text-[#181c20]">Identidade deste envio</h2>
          </div>
          <p className="mt-2 text-sm text-[#667085]">As cores padrão vêm da instituição. Alterações valem somente para este e-mail.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ColorField label="Cor primária" value={primaryColor} onChange={setPrimaryColor} />
            <ColorField label="Cor secundária" value={secondaryColor} onChange={setSecondaryColor} />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#667085]">A confirmação exibirá a quantidade real antes do envio.</p>
          <button type="submit" disabled={isPreviewing || audienceRecipients.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#004a9b] disabled:cursor-not-allowed disabled:opacity-50">
            <Eye className="h-4 w-4" aria-hidden="true" />
            {isPreviewing ? 'Preparando preview...' : 'Pré-visualizar e revisar'}
          </button>
        </div>
      </form>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="email-confirm-title" className="flex max-h-[calc(100dvh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#dfe3e8] p-5">
              <div>
                <h2 id="email-confirm-title" className="text-lg font-extrabold text-[#181c20]">Revisar e-mail institucional</h2>
                <p className="mt-1 text-sm text-[#667085]">{preview.recipientCount} destinatário(s) serão processados. {preview.recipientsWithoutEmail} sem e-mail serão ignorados.</p>
              </div>
              <button type="button" aria-label="Fechar revisão" onClick={() => setPreview(null)} className="rounded-lg p-2 text-[#667085] hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf]">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto bg-[#f8fafc] p-4">
              <iframe title="Prévia do e-mail" srcDoc={preview.previewHtml} sandbox="" className="h-[430px] w-full rounded-lg border border-[#dfe3e8] bg-white" />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-[#dfe3e8] p-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-[#cfd6e2] px-4 py-2.5 text-sm font-bold text-[#414754] hover:bg-[#f8fafc]">Cancelar</button>
              <button type="button" onClick={handleSend} disabled={isSending || preview.recipientCount === preview.recipientsWithoutEmail} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004a9b] disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" aria-hidden="true" />
                {isSending ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-[#cfd6e2] bg-white px-3 py-2.5 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-[#005bbf]/20';

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-bold text-[#414754]">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-[#dfe3e8] p-3 text-sm font-bold text-[#414754]">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className="h-9 w-12 cursor-pointer rounded border border-[#cfd6e2] bg-white p-1" />
        <code className="text-xs font-normal text-[#667085]">{value}</code>
      </span>
    </label>
  );
}

function UsersIcon() {
  return <Users className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />;
}

function PaletteIcon() {
  return <Palette className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />;
}

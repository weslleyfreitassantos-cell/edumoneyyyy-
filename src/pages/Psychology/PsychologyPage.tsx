import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  psychologyErrorMessage,
  psychologyService,
  type PsychologyAppointment,
  type PsychologyAvailabilityBlock,
  type PsychologyAvailabilityRule,
  type PsychologyAuthorizationTarget,
  type PsychologyManagementCandidates,
  type PsychologyMessage,
  type PsychologyNote,
  type PsychologyNoteVersion,
  type PsychologySlot,
} from '../../services/psychologyService';

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const EMPTY_NOTE = {
  objective: '',
  session_record: '',
  referrals: '',
  next_steps: '',
};

const sectionLabels: Record<string, string> = {
  agendar: 'Agendar consulta',
  agendamentos: 'Meus agendamentos',
  chat: 'Chat',
  autorizacao: 'Autorizações',
  agenda: 'Agenda',
  atendimentos: 'Atendimentos',
  anotacoes: 'Anotações clínicas',
  disponibilidade: 'Disponibilidade',
  configuracao: 'Configuração',
};

function getLocalDateKey(date: Date, timezone = BRAZIL_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDateDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTimeZoneOffsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - instant;
}

function localDateStartIso(dateKey: string, timezone = BRAZIL_TIMEZONE): string {
  const nominalUtc = Date.parse(`${dateKey}T00:00:00Z`);
  let startUtc = nominalUtc - getTimeZoneOffsetMs(nominalUtc, timezone);
  startUtc = nominalUtc - getTimeZoneOffsetMs(startUtc, timezone);
  return new Date(startUtc).toISOString();
}

function formatDateTime(value: string, timezone = BRAZIL_TIMEZONE): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

function getSection(pathname: string): string {
  return pathname.split('/')[2] || 'agendar';
}

function roleLabel(role: string): string {
  if (role === 'PSYCHOLOGIST') return 'Psicóloga(o)';
  if (role === 'STUDENT') return 'Estudante';
  if (role === 'GUARDIAN') return 'Responsável';
  return 'Equipe da instituição';
}

function SectionNav({ role, section }: { role: string; section: string }) {
  const roleSections: Record<string, string[]> = {
    STUDENT: ['agendar', 'agendamentos', 'chat', 'autorizacao'],
    GUARDIAN: ['autorizacao'],
    PSYCHOLOGIST: ['agenda', 'atendimentos', 'anotacoes', 'disponibilidade'],
    ADMIN: ['configuracao'],
    DIRECTOR: ['configuracao'],
    SECRETARY: ['configuracao'],
  };
  const sections = roleSections[role] ?? [];
  if (!sections.length) return null;
  return (
    <nav aria-label="Seções do apoio psicológico" className="mb-6 flex flex-wrap gap-2">
      {sections.map((item) => (
        <Link
          key={item}
          to={`/psychology/${item}`}
          aria-current={section === item ? 'page' : undefined}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${section === item ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
        >
          {sectionLabels[item]}
        </Link>
      ))}
    </nav>
  );
}

function AuthorizationPanel({
  targets,
  role,
  moduleEnabled,
  onRefresh,
  onFeedback,
}: {
  targets: PsychologyAuthorizationTarget[];
  role: string;
  moduleEnabled: boolean;
  onRefresh: () => void;
  onFeedback: (message: string) => void;
}) {
  const [checks, setChecks] = useState<Record<string, [boolean, boolean, boolean]>>({});
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  async function authorize(target: PsychologyAuthorizationTarget) {
    const allowedSigner = target.is_minor ? role === 'GUARDIAN' : role === 'STUDENT';
    if (!allowedSigner || !(checks[target.student_id] ?? [false, false, false]).every(Boolean)) return;
    setBusyStudentId(target.student_id);
    try {
      await psychologyService.recordAuthorization(target.student_id);
      onFeedback(`Autorização registrada para ${target.student_name}.`);
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusyStudentId(null);
    }
  }

  async function revoke(target: PsychologyAuthorizationTarget) {
    setBusyStudentId(target.student_id);
    try {
      await psychologyService.revokeAuthorization(target.student_id);
      onFeedback(`Autorização revogada para ${target.student_name}.`);
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusyStudentId(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="psychology-authorization-title">
      <div>
        <h2 id="psychology-authorization-title" className="text-xl font-bold text-slate-900 dark:text-white">Autorizações</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">O servidor confirma o vínculo do responsável ou a identidade do estudante adulto antes de registrar a autorização.</p>
      </div>
      {targets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-5 text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhum estudante vinculado está disponível para este perfil nesta instituição.</p>
      ) : targets.map((target) => {
        const canSign = target.is_minor ? role === 'GUARDIAN' : role === 'STUDENT';
        const selected = checks[target.student_id] ?? [false, false, false];
        return (
          <article key={target.student_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{target.student_name}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {target.authorization_status === 'ACTIVE' ? 'Autorização ativa' : target.authorization_status === 'REVOKED' ? 'Autorização revogada' : 'Ainda sem autorização'}
                  {target.is_minor ? ' · requer responsável legal vinculado' : ' · autorização pelo próprio estudante'}
                </p>
              </div>
              {target.authorization_status === 'ACTIVE' && target.is_signatory ? (
                <button type="button" disabled={busyStudentId === target.student_id} onClick={() => void revoke(target)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-300">Revogar autorização</button>
              ) : null}
            </div>
            {target.authorization_status !== 'ACTIVE' ? (
              canSign ? (
                moduleEnabled ? <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {[
                    'Li o aviso de privacidade do módulo e entendi que mensagens e anotações têm acesso restrito, separado do cadastro acadêmico.',
                    'Entendi as condições do serviço: atendimento humano por agendamento, sem monitoramento contínuo ou serviço de emergência.',
                    'Autorizo o atendimento psicológico deste estudante por uma profissional habilitada e vinculada à instituição.',
                  ].map((label, index) => (
                    <label key={label} className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={selected[index]}
                        onChange={(event) => setChecks((current) => {
                          const next = [...(current[target.student_id] ?? [false, false, false])] as [boolean, boolean, boolean];
                          next[index] = event.target.checked;
                          return { ...current, [target.student_id]: next };
                        })}
                        className="mt-1 h-4 w-4 accent-blue-700"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  <button type="button" disabled={busyStudentId === target.student_id || !selected.every(Boolean)} onClick={() => void authorize(target)} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {busyStudentId === target.student_id ? 'Registrando…' : 'Registrar autorização'}
                  </button>
                </div> : <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">A escola ainda não habilitou o Apoio psicológico. A autorização poderá ser registrada quando o módulo estiver ativo.</p>
              ) : (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  {target.is_minor ? 'A autorização deste estudante precisa ser registrada por um responsável legal com vínculo ativo no cadastro.' : 'Este estudante é adulto. A autorização deve ser registrada pelo próprio estudante.'}
                </p>
              )
            ) : (
              <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">O vínculo e o estado da autorização são verificados novamente no servidor em cada operação.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

function ManagementPanel({
  institutionId,
  candidates,
  moduleEnabled,
  onRefresh,
  onFeedback,
}: {
  institutionId: string;
  candidates: PsychologyManagementCandidates | null;
  moduleEnabled: boolean;
  onRefresh: () => void;
  onFeedback: (message: string) => void;
}) {
  const [professionalId, setProfessionalId] = useState('');
  const [crp, setCrp] = useState('');
  const [crpState, setCrpState] = useState('BA');
  const [studentId, setStudentId] = useState('');
  const [assignmentProfessionalId, setAssignmentProfessionalId] = useState('');
  const [busy, setBusy] = useState(false);

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!professionalId) return;
    setBusy(true);
    try {
      await psychologyService.registerProfessional(institutionId, professionalId, crp.trim(), crpState);
      onFeedback('Dados profissionais salvos. A habilitação exige verificação humana do CRP.');
      setCrp('');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function verify(profileId: string) {
    setBusy(true);
    try {
      await psychologyService.verifyProfessional(institutionId, profileId);
      onFeedback('Verificação humana registrada e vínculo profissional habilitado nesta instituição.');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!studentId || !assignmentProfessionalId) return;
    setBusy(true);
    try {
      await psychologyService.setStudentAssignment(institutionId, studentId, assignmentProfessionalId, true);
      onFeedback('Vínculo de acompanhamento registrado. O profissional verá apenas os estudantes atribuídos.');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function unassign(student: PsychologyManagementCandidates['students'][number], professionalIdToRemove: string) {
    setBusy(true);
    try {
      await psychologyService.setStudentAssignment(institutionId, student.student_id, professionalIdToRemove, false);
      onFeedback(`Acompanhamento encerrado para ${student.full_name}.`);
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function changeModuleState() {
    setBusy(true);
    try {
      await psychologyService.setModuleEnabled(institutionId, !moduleEnabled);
      onFeedback(moduleEnabled
        ? 'Apoio psicológico desativado. Os registros foram preservados.'
        : 'Apoio psicológico habilitado para esta instituição.');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const availableProfessionals = candidates?.professionals.filter((item) => item.registered && item.verification_status === 'VERIFIED' && item.linked) ?? [];
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configuração operacional</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A administração pode preparar os vínculos e verificar profissionais. Esta área não exibe conversas nem anotações clínicas.</p>
      </div>
      {!moduleEnabled ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">O módulo permanece desativado no servidor. Nenhum agendamento, chat ou registro clínico pode ser criado até a habilitação local controlada.</p>
      ) : null}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Disponibilidade do módulo</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{moduleEnabled ? 'Ativo nesta instituição.' : 'Desativado. Os registros existentes serão preservados.'}</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void changeModuleState()} className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 ${moduleEnabled ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
          {busy ? 'Salvando…' : moduleEnabled ? 'Desativar módulo' : 'Habilitar módulo'}
        </button>
      </section>
      <form onSubmit={(event) => void register(event)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_1fr_6rem_auto]">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Profissional convidada
          <select required value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">
            <option value="">Selecione</option>
            {(candidates?.professionals ?? []).map((item) => <option key={item.profile_id} value={item.profile_id}>{item.full_name} · {item.email}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Registro CRP
          <input required value={crp} onChange={(event) => setCrp(event.target.value)} maxLength={20} placeholder="Número do registro" className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">UF
          <input required value={crpState} onChange={(event) => setCrpState(event.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 uppercase dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <div className="self-end"><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Salvar perfil</button></div>
      </form>
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white">Profissionais e habilitação humana</h3>
        {(candidates?.professionals ?? []).map((item) => (
          <article key={item.profile_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div><p className="font-semibold text-slate-900 dark:text-white">{item.full_name}</p><p className="text-sm text-slate-600 dark:text-slate-300">{item.registered ? `CRP ${item.crp_registration}/${item.crp_state} · ${item.verification_status === 'VERIFIED' ? 'verificado' : 'pendente de verificação'}` : 'Perfil profissional ainda não cadastrado'}</p></div>
            {item.registered && item.verification_status !== 'VERIFIED' ? <button disabled={busy} onClick={() => void verify(item.profile_id)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200">Confirmo verificação humana do CRP</button> : null}
          </article>
        ))}
        {!candidates?.professionals.length ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Convide primeiro uma pessoa com o perfil Psicóloga(o) pela área Usuários.</p> : null}
      </div>
      <form onSubmit={(event) => void assign(event)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Estudante
          <select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione</option>{(candidates?.students ?? []).map((item) => <option key={item.student_id} value={item.student_id}>{item.full_name} · {item.registration_number ?? 'sem matrícula'}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Profissional habilitada
          <select required value={assignmentProfessionalId} onChange={(event) => setAssignmentProfessionalId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione</option>{availableProfessionals.map((item) => <option key={item.profile_id} value={item.profile_id}>{item.full_name}</option>)}</select>
        </label>
        <div className="self-end"><button disabled={busy || !availableProfessionals.length} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Vincular estudante</button></div>
      </form>
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900 dark:text-white">Vínculos e estado da autorização</h3>
        {(candidates?.students ?? []).map((item) => (
          <article key={item.student_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div><p className="font-semibold text-slate-900 dark:text-white">{item.full_name}</p><p className="text-sm text-slate-600 dark:text-slate-300">{item.assigned ? 'Possui vínculo de acompanhamento ativo' : 'Sem vínculo ativo'} · autorização: {item.authorization_status ?? 'pendente'}</p></div>
            {item.assigned ? <select aria-label={`Encerrar vínculo de ${item.full_name}`} defaultValue="" onChange={(event) => { const targetId = event.target.value; if (targetId) void unassign(item, targetId); event.currentTarget.value = ''; }} disabled={busy} className="rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Encerrar vínculo…</option>{item.assigned_professionals.map((professional) => <option key={professional.profile_id} value={professional.profile_id}>{professional.full_name}</option>)}</select> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AppointmentCard({
  appointment,
  mode,
  onOpenChat,
  onOpenNote,
  onRefresh,
  onFeedback,
  slots,
}: {
  key?: string;
  appointment: PsychologyAppointment;
  mode: 'student' | 'psychologist' | 'manager';
  onOpenChat: (appointment: PsychologyAppointment) => void;
  onOpenNote: (appointment: PsychologyAppointment) => void;
  onRefresh: () => void;
  onFeedback: (message: string) => void;
  slots: PsychologySlot[];
}) {
  const [busy, setBusy] = useState(false);
  const [newStart, setNewStart] = useState('');
  const cancelOperationKey = useRef<string | null>(null);
  const rescheduleOperation = useRef<{ startsAt: string; key: string } | null>(null);
  const canManageSession = mode === 'psychologist';

  async function cancel() {
    setBusy(true);
    try {
      cancelOperationKey.current ??= crypto.randomUUID();
      await psychologyService.cancelAppointment(appointment.appointment_id, cancelOperationKey.current);
      cancelOperationKey.current = null;
      onFeedback('Agendamento cancelado.');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function reschedule() {
    if (!newStart) return;
    setBusy(true);
    try {
      if (rescheduleOperation.current?.startsAt !== newStart) {
        rescheduleOperation.current = { startsAt: newStart, key: crypto.randomUUID() };
      }
      await psychologyService.rescheduleAppointment(appointment.appointment_id, newStart, rescheduleOperation.current.key);
      rescheduleOperation.current = null;
      onFeedback('Agendamento remarcado.');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function sessionAction(action: 'start' | 'complete' | 'no-show') {
    setBusy(true);
    try {
      if (action === 'start') await psychologyService.startSession(appointment.session_id);
      else await psychologyService.closeSession(appointment.session_id, action === 'complete' ? 'COMPLETED' : 'NO_SHOW');
      onFeedback(action === 'start' ? 'Atendimento iniciado.' : action === 'complete' ? 'Atendimento encerrado.' : 'Ausência registrada.');
      onRefresh();
    } catch (error) {
      onFeedback(psychologyErrorMessage(error));
    } finally { setBusy(false); }
  }

  const personLabel = mode === 'student' ? appointment.professional_name : appointment.student_name;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">{personLabel}</h3>
          {mode === 'student' ? <p className="text-sm text-slate-600 dark:text-slate-300">CRP {appointment.crp_registration}/{appointment.crp_state}</p> : null}
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDateTime(appointment.starts_at)} – {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: BRAZIL_TIMEZONE }).format(new Date(appointment.ends_at))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{appointment.status === 'SCHEDULED' ? appointment.session_status === 'WAITING' ? 'Aguardando profissional' : appointment.session_status === 'IN_PROGRESS' ? 'Em atendimento' : 'Agendado' : appointment.status === 'CANCELLED' ? 'Cancelado' : appointment.status === 'NO_SHOW' ? 'Ausência registrada' : 'Concluído'}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {mode !== 'manager' && appointment.status !== 'CANCELLED' ? <button type="button" onClick={() => onOpenChat(appointment)} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 dark:border-blue-800 dark:text-blue-200">Abrir chat</button> : null}
        {canManageSession ? <button type="button" onClick={() => onOpenNote(appointment)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-200">Anotações clínicas</button> : null}
        {canManageSession && appointment.status === 'SCHEDULED' && appointment.session_status === 'WAITING' ? <button type="button" disabled={busy} onClick={() => void sessionAction('start')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Iniciar atendimento</button> : null}
        {canManageSession && appointment.status === 'SCHEDULED' && appointment.session_status === 'IN_PROGRESS' ? <button type="button" disabled={busy} onClick={() => void sessionAction('complete')} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900">Encerrar atendimento</button> : null}
        {canManageSession && appointment.status === 'SCHEDULED' && appointment.session_status === 'WAITING' && new Date() > new Date(appointment.ends_at) ? <button type="button" disabled={busy} onClick={() => void sessionAction('no-show')} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50 dark:border-amber-800 dark:text-amber-200">Registrar ausência</button> : null}
        {mode === 'student' && appointment.status === 'SCHEDULED' ? <button type="button" disabled={busy} onClick={() => void cancel()} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300">Cancelar</button> : null}
      </div>
      {mode === 'student' && appointment.status === 'SCHEDULED' && slots.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor={`reschedule-${appointment.appointment_id}`}>Novo horário</label>
          <select id={`reschedule-${appointment.appointment_id}`} value={newStart} onChange={(event) => setNewStart(event.target.value)} className="min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="">Escolher horário para remarcar</option>{slots.map((slot) => <option key={`${slot.professional_profile_id}-${slot.starts_at}`} value={slot.starts_at}>{formatDateTime(slot.starts_at, slot.timezone)} · {slot.professional_name}</option>)}</select>
          <button type="button" disabled={busy || !newStart} onClick={() => void reschedule()} className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200">Remarcar</button>
        </div>
      ) : null}
      {mode === 'student' && appointment.session_status === 'WAITING' && appointment.status === 'SCHEDULED' ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Você poderá conversar quando a profissional iniciar o atendimento. Entrar nesta tela não inicia a consulta.</p> : null}
      {mode === 'manager' ? <p className="mt-3 text-xs text-slate-500">Visualização operacional; o conteúdo do atendimento e as anotações não são exibidos.</p> : null}
    </article>
  );
}

function ChatPanel({
  appointment,
  profileId,
  role,
}: {
  appointment: PsychologyAppointment;
  profileId: string;
  role: string;
}) {
  const [messages, setMessages] = useState<PsychologyMessage[]>([]);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState<{ key: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Conectando ao atendimento…');
  const [error, setError] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const [accessValid, setAccessValid] = useState(true);
  const syncing = useRef(false);

  useEffect(() => {
    let active = true;
    let refreshRequested = false;
    syncing.current = false;
    setAccessValid(true);
    setMessages([]);
    setPending(null);
    setBody('');
    setError('');
    setLoading(true);
    setStatus('Conectando ao atendimento…');
    let lastLoadedId: number | undefined;
    const refreshLatest = async () => {
      if (!active) return;
      if (syncing.current) {
        refreshRequested = true;
        return;
      }
      syncing.current = true;
      try {
        do {
          refreshRequested = false;
          const latest = await psychologyService.listMessages(
            appointment.session_id,
            lastLoadedId === undefined ? {} : { afterId: lastLoadedId },
          );
          if (!active) return;
          if (lastLoadedId === undefined) setHasOlder(latest.length === 100);
          if (latest.length) lastLoadedId = latest[latest.length - 1].id;
          if (latest.length === 100) refreshRequested = true;
          setMessages((current) => {
            const byId = new Map<number, PsychologyMessage>();
            [...current, ...latest].forEach((message) => byId.set(message.id, message));
            return [...byId.values()].sort((left, right) => left.id - right.id);
          });
        } while (active && refreshRequested);
      } catch (caught) {
        if (active) setError(psychologyErrorMessage(caught));
      } finally {
        syncing.current = false;
        if (active) setLoading(false);
      }
    };
    const subscription = psychologyService.subscribeMessages(
      appointment.session_id,
      () => { void refreshLatest(); },
      (realtimeStatus) => {
        if (!active) return;
        setStatus(realtimeStatus === 'SUBSCRIBED'
          ? 'Tempo real conectado'
          : 'Reconectando; sincronização automática ativa');
        if (realtimeStatus === 'SUBSCRIBED') void refreshLatest();
      },
    );
    const validateAccess = async () => {
      try {
        const allowed = await psychologyService.checkSessionAccess(appointment.session_id);
        if (active && !allowed) {
          setAccessValid(false);
          setMessages([]);
          setBody('');
          setPending(null);
          setError('Seu acesso a este atendimento foi revogado. O conteúdo foi removido desta tela.');
          setStatus('Acesso encerrado');
          subscription.unsubscribe();
        }
      } catch {
        if (active) {
          setAccessValid(false);
          setMessages([]);
          setBody('');
          setPending(null);
          setError('Não foi possível confirmar a autorização deste atendimento. Atualize a página para continuar.');
          subscription.unsubscribe();
        }
      }
    };
    const accessTimer = window.setInterval(() => { void validateAccess(); }, 30000);
    const messageSyncTimer = window.setInterval(() => { void refreshLatest(); }, 15000);
    window.addEventListener('focus', validateAccess);
    void validateAccess();
    subscription.ready.then(() => {
      if (!active) return;
      setStatus('Tempo real conectado');
      void refreshLatest();
    }).catch(() => {
      if (active) {
        setStatus('Sem atualização em tempo real; tente reconectar.');
        void refreshLatest();
      }
    });
    return () => {
      active = false;
      window.clearInterval(accessTimer);
      window.clearInterval(messageSyncTimer);
      window.removeEventListener('focus', validateAccess);
      subscription.unsubscribe();
    };
  }, [appointment.session_id]);

  async function loadOlder() {
    const firstId = messages[0]?.id;
    if (!firstId) return;
    try {
      const older = await psychologyService.listMessages(appointment.session_id, { beforeId: firstId });
      setMessages((current) => [...older, ...current]);
      setHasOlder(older.length === 100);
    } catch (caught) { setError(psychologyErrorMessage(caught)); }
  }

  async function send() {
    const current = pending ?? (body.trim() ? { key: crypto.randomUUID(), body: body.trim() } : null);
    if (!current) return;
    setPending(current);
    setError('');
    try {
      await psychologyService.sendMessage(appointment.session_id, current.body, current.key);
      setBody('');
      setPending(null);
      await psychologyService.listMessages(appointment.session_id).then((latest) => {
        setMessages((old) => [...new Map([...old, ...latest].map((message) => [message.id, message])).values()].sort((a, b) => a.id - b.id));
      });
    } catch (caught) {
      setError(psychologyErrorMessage(caught));
    }
  }

  const canSend = accessValid && appointment.session_status === 'IN_PROGRESS' && appointment.status === 'SCHEDULED';
  const isProfessional = role === 'PSYCHOLOGIST';
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-label="Chat privado do atendimento">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div><h3 className="font-bold text-slate-900 dark:text-white">Chat do atendimento</h3><p className="text-xs text-slate-500">{isProfessional ? appointment.student_name : appointment.professional_name} · {status}</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{appointment.session_status === 'WAITING' ? 'Aguardando a profissional' : appointment.session_status === 'CLOSED' ? 'Atendimento encerrado' : 'Atendimento em andamento'}</span>
      </div>
      <p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Este canal funciona durante o atendimento agendado e não é monitorado continuamente. Em situações urgentes, procure os serviços de emergência ou os contatos institucionais validados pela escola.</p>
      <div className="mt-4 flex max-h-[26rem] min-h-48 flex-col gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-950" aria-live="polite" aria-relevant="additions text">
        {hasOlder ? <button type="button" onClick={() => void loadOlder()} className="self-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Carregar mensagens anteriores</button> : null}
        {loading ? <p role="status" className="m-auto text-sm text-slate-500">Carregando mensagens…</p> : null}
        {!loading && messages.length === 0 ? <p className="m-auto text-sm text-slate-500">Ainda não há mensagens neste atendimento.</p> : null}
        {messages.map((message) => (
          <article key={message.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.sender_profile_id === profileId ? 'self-end bg-blue-700 text-white' : 'self-start bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'}`}>
            <p className="mb-1 text-[11px] font-bold opacity-75">{message.sender_profile_id === profileId ? 'Você' : isProfessional ? 'Estudante' : 'Profissional'} · {formatDateTime(message.created_at)}</p>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </article>
        ))}
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}
      {canSend ? (
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="psychology-message">Mensagem</label>
          <textarea id="psychology-message" value={pending?.body ?? body} onChange={(event) => { setPending(null); setBody(event.target.value); }} maxLength={2000} rows={2} placeholder="Escreva uma mensagem para a profissional" className="min-h-12 flex-1 resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <button type="submit" disabled={(!pending && !body.trim()) || loading} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Tentar novamente' : 'Enviar'}</button>
        </form>
      ) : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Novas mensagens ficam disponíveis quando a profissional inicia o atendimento e são bloqueadas ao seu encerramento. O histórico autorizado permanece disponível.</p>}
    </section>
  );
}

function ClinicalNoteEditor({ appointment }: { key?: string; appointment: PsychologyAppointment }) {
  const [note, setNote] = useState<PsychologyNote | null>(null);
  const [versions, setVersions] = useState<PsychologyNoteVersion[]>([]);
  const [content, setContent] = useState<Record<string, string>>(EMPTY_NOTE);
  const [addendum, setAddendum] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [error, setError] = useState('');
  const lastSavedContent = useRef(JSON.stringify(EMPTY_NOTE));
  const savingRef = useRef(false);

  async function load() {
    setLoaded(false);
    setNote(null);
    setContent(EMPTY_NOTE);
    lastSavedContent.current = JSON.stringify(EMPTY_NOTE);
    setError('');
    try {
      const saved = await psychologyService.getNote(appointment.session_id);
      if (saved) {
        setNote(saved);
        setContent(saved.content);
        lastSavedContent.current = JSON.stringify(saved.content);
        setVersions(await psychologyService.listNoteVersions(saved.id));
      } else {
        setVersions([]);
      }
    } catch (caught) { setError(psychologyErrorMessage(caught)); }
    finally { setLoaded(true); }
  }

  useEffect(() => {
    void load();
    return () => {
      setNote(null);
      setVersions([]);
      setContent(EMPTY_NOTE);
    };
  }, [appointment.session_id]);

  async function persist(snapshot = content): Promise<number> {
    if (savingRef.current) throw new Error('VERSION_CONFLICT');
    savingRef.current = true;
    setSaving(true);
    setSaveState('Salvando…');
    try {
      const result = await psychologyService.saveNoteDraft(appointment.session_id, note?.version ?? 0, snapshot);
      const saved = await psychologyService.getNote(appointment.session_id);
      if (saved) {
        setNote(saved);
        setVersions(await psychologyService.listNoteVersions(saved.id));
      }
      lastSavedContent.current = JSON.stringify(snapshot);
      setSaveState('Rascunho salvo no servidor');
      return result.version;
    } catch (caught) {
      setSaveState('Falha ao salvar');
      setError(psychologyErrorMessage(caught));
      throw caught;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!loaded || note?.status === 'FINALIZED' || JSON.stringify(content) === lastSavedContent.current) return;
    const timer = window.setTimeout(() => { void persist(content).catch(() => undefined); }, 900);
    return () => window.clearTimeout(timer);
  }, [content, loaded, note?.status, note?.version]);

  async function finalize() {
    setError('');
    try {
      const version = JSON.stringify(content) === lastSavedContent.current ? (note?.version ?? 0) : await persist(content);
      await psychologyService.finalizeNote(appointment.session_id, version);
      await load();
      setSaveState('Registro finalizado. Correções futuras devem ser adicionadas como adendo.');
    } catch (caught) { setError(psychologyErrorMessage(caught)); }
  }

  async function createAddendum(event: FormEvent) {
    event.preventDefault();
    if (!note || !addendum.trim()) return;
    try {
      await psychologyService.addNoteAddendum(appointment.session_id, note.version, addendum.trim());
      setAddendum('');
      await load();
      setSaveState('Adendo registrado em nova versão.');
    } catch (caught) { setError(psychologyErrorMessage(caught)); }
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 dark:border-amber-900 dark:bg-amber-950/20" aria-label="Registro clínico restrito">
      <div className="mb-4"><h3 className="font-bold text-slate-900 dark:text-white">Anotação clínica · acesso restrito à profissional</h3><p className="text-sm text-slate-600 dark:text-slate-300">Conteúdo separado do chat e do cadastro escolar. O texto fica apenas em memória até ser salvo no servidor.</p></div>
      {!loaded ? <p role="status" className="text-sm">Carregando registro restrito…</p> : note?.status === 'FINALIZED' ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold text-emerald-800 dark:bg-slate-900 dark:text-emerald-200">Registro finalizado · versão {note.version}. O conteúdo original não pode ser sobrescrito.</p>
          <dl className="grid gap-3 md:grid-cols-2">{Object.entries(note.content).map(([key, value]) => <div key={key} className="rounded-lg bg-white p-3 dark:bg-slate-900"><dt className="text-xs font-bold uppercase text-slate-500">{key === 'objective' ? 'Objetivo' : key === 'session_record' ? 'Registro do atendimento' : key === 'referrals' ? 'Encaminhamentos' : 'Próximos passos'}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{String(value)}</dd></div>)}</dl>
          <form onSubmit={(event) => void createAddendum(event)} className="space-y-2"><label htmlFor="psychology-addendum" className="font-semibold">Novo adendo</label><textarea id="psychology-addendum" value={addendum} onChange={(event) => setAddendum(event.target.value)} maxLength={10000} rows={3} className="block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" /><button disabled={!addendum.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Registrar adendo</button></form>
          <VersionHistory versions={versions} />
        </div>
      ) : (
        <div className="space-y-3">
          {[
            ['objective', 'Demanda ou objetivo'],
            ['session_record', 'Registro do atendimento'],
            ['referrals', 'Encaminhamentos'],
            ['next_steps', 'Próximos passos'],
          ].map(([key, label]) => <label key={key} className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}<textarea value={content[key] ?? ''} onChange={(event) => setContent((current) => ({ ...current, [key]: event.target.value }))} maxLength={10000} rows={key === 'session_record' ? 5 : 3} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-900" /></label>)}
          <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={saving} onClick={() => void persist()} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200">Salvar rascunho</button><button type="button" disabled={saving || !Object.values(content).some((value) => String(value).trim())} onClick={() => void finalize()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Finalizar registro</button><span role="status" className="text-sm text-slate-600 dark:text-slate-300">{saveState || 'Rascunho ainda não salvo'}</span></div>
          {note ? <VersionHistory versions={versions} /> : null}
        </div>
      )}
      {error ? <p role="alert" className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-200">{error}</p> : null}
    </section>
  );
}

function VersionHistory({ versions }: { versions: PsychologyNoteVersion[] }) {
  if (!versions.length) return null;
  return <details className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"><summary className="cursor-pointer text-sm font-semibold">Histórico de versões ({versions.length})</summary><ol className="mt-3 space-y-2">{versions.map((version) => <li key={version.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800"><p className="font-semibold">Versão {version.version} · {version.kind === 'DRAFT_SAVE' ? 'rascunho' : version.kind === 'FINALIZED' ? 'finalizada' : 'adendo'}</p><p className="text-xs text-slate-500">{formatDateTime(version.created_at)}</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs">{Object.values(version.content).join('\n')}</pre></li>)}</ol></details>;
}

function AvailabilityPanel({
  institutionId,
  profileId,
  rules,
  blocks,
  onRefresh,
  onFeedback,
}: {
  institutionId: string;
  profileId: string;
  rules: PsychologyAvailabilityRule[];
  blocks: PsychologyAvailabilityBlock[];
  onRefresh: () => void;
  onFeedback: (message: string) => void;
}) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('13:00');
  const [end, setEnd] = useState('17:00');
  const [sessionMinutes, setSessionMinutes] = useState(50);
  const [preparationMinutes, setPreparationMinutes] = useState(10);
  const [validFrom, setValidFrom] = useState(getLocalDateKey(new Date()));
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [busy, setBusy] = useState(false);

  async function addRule(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await psychologyService.setAvailabilityRule({ institutionId, ruleId: null, dayOfWeek: day, startLocal: start, endLocal: end, timezone: BRAZIL_TIMEZONE, sessionMinutes, preparationMinutes, validFrom, validUntil: null, active: true });
      onFeedback('Horário semanal publicado. Os agendamentos existentes foram preservados.');
      onRefresh();
    } catch (error) { onFeedback(psychologyErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function addBlock(event: FormEvent) {
    event.preventDefault();
    if (!blockStart || !blockEnd) return;
    setBusy(true);
    try {
      await psychologyService.addAvailabilityBlock(institutionId, new Date(blockStart).toISOString(), new Date(blockEnd).toISOString());
      setBlockStart(''); setBlockEnd('');
      onFeedback('Bloqueio de agenda salvo.');
      onRefresh();
    } catch (error) { onFeedback(psychologyErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function removeBlock(blockId: string) {
    setBusy(true);
    try { await psychologyService.removeAvailabilityBlock(institutionId, blockId); onFeedback('Bloqueio removido.'); onRefresh(); }
    catch (error) { onFeedback(psychologyErrorMessage(error)); }
    finally { setBusy(false); }
  }

  const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return (
    <section className="space-y-6">
      <div><h2 className="text-xl font-bold text-slate-900 dark:text-white">Disponibilidade</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Agenda no fuso {BRAZIL_TIMEZONE}. Duração inicial de 50 minutos e intervalo de 10 minutos.</p></div>
      <form onSubmit={(event) => void addRule(event)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">Dia<select value={day} onChange={(event) => setDay(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">{dayNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
        <label className="text-sm font-semibold">Início<input type="time" value={start} onChange={(event) => setStart(event.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
        <label className="text-sm font-semibold">Fim<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
        <label className="text-sm font-semibold">Disponível a partir de<input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} required className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
        <label className="text-sm font-semibold">Duração (min)<input type="number" min={20} max={120} value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
        <label className="text-sm font-semibold">Intervalo (min)<input type="number" min={0} max={60} value={preparationMinutes} onChange={(event) => setPreparationMinutes(Number(event.target.value))} className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
        <div className="self-end"><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Publicar horário</button></div>
      </form>
      <div className="space-y-2"><h3 className="font-bold">Horários semanais publicados</h3>{rules.map((rule) => <article key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900"><strong>{dayNames[rule.day_of_week]}</strong> · {rule.start_local.slice(0, 5)}–{rule.end_local.slice(0, 5)} · {rule.session_minutes} min + intervalo de {rule.preparation_minutes} min · {rule.active ? 'ativo' : 'pausado'}</article>)}{!rules.length ? <p className="text-sm text-slate-500">Nenhum horário semanal publicado.</p> : null}</div>
      <form onSubmit={(event) => void addBlock(event)} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold">Bloquear a partir de<input type="datetime-local" required value={blockStart} onChange={(event) => setBlockStart(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-semibold">Até<input type="datetime-local" required value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-950" /></label><div className="self-end"><button disabled={busy} className="rounded-lg border border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200">Adicionar bloqueio</button></div></form>
      <div className="space-y-2"><h3 className="font-bold">Exceções futuras</h3>{blocks.map((block) => <article key={block.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><span className="text-sm">{formatDateTime(block.starts_at)} até {formatDateTime(block.ends_at)}</span><button type="button" disabled={busy} onClick={() => void removeBlock(block.id)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300">Remover bloqueio</button></article>)}{!blocks.length ? <p className="text-sm text-slate-500">Nenhum bloqueio futuro.</p> : null}</div>
    </section>
  );
}

export default function PsychologyPage() {
  const { profile } = useAuth();
  const { currentInstitution, currentInstitutionId, currentRole } = useInstitution();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = getSection(location.pathname);
  const role = (currentRole ?? profile?.role ?? '').toUpperCase();
  const isManager = ['ADMIN', 'DIRECTOR', 'SECRETARY'].includes(role);
  const institutionId = currentInstitutionId;
  const profileId = profile?.id ?? '';
  const contextKey = `${profileId}:${institutionId ?? ''}:${role}`;
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedContextKey, setLoadedContextKey] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [candidates, setCandidates] = useState<PsychologyManagementCandidates | null>(null);
  const [targets, setTargets] = useState<PsychologyAuthorizationTarget[]>([]);
  const [appointments, setAppointments] = useState<PsychologyAppointment[]>([]);
  const [slots, setSlots] = useState<PsychologySlot[]>([]);
  const [availability, setAvailability] = useState<PsychologyAvailabilityRule[]>([]);
  const [blocks, setBlocks] = useState<PsychologyAvailabilityBlock[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(searchParams.get('appointment'));
  const [slotDate, setSlotDate] = useState(getLocalDateKey(new Date()));
  const [appointmentsFrom, setAppointmentsFrom] = useState(getLocalDateKey(new Date(Date.now() - 30 * 86400000)));
  const [appointmentsThrough, setAppointmentsThrough] = useState(getLocalDateKey(new Date(Date.now() + 30 * 86400000)));
  const [bookingBusyKey, setBookingBusyKey] = useState<string | null>(null);
  const bookingKeys = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadedContextKey('');
    setModuleEnabled(false);
    setFeedback('');
    setCandidates(null);
    setTargets([]);
    setAppointments([]);
    setSlots([]);
    setAvailability([]);
    setBlocks([]);
    bookingKeys.current.clear();
    setBookingBusyKey(null);
    setSelectedAppointmentId(searchParams.get('appointment'));
    if (!institutionId || !profileId) {
      setLoading(false);
      setLoadedContextKey(contextKey);
      return () => { active = false; };
    }

    const load = async () => {
      try {
        const enabled = await psychologyService.moduleEnabled(institutionId);
        if (!active) return;
        setModuleEnabled(enabled);
        let studentTargets: PsychologyAuthorizationTarget[] = [];
        if (['STUDENT', 'GUARDIAN'].includes(role)) {
          studentTargets = await psychologyService.listMyAuthorizationTargets(institutionId);
          if (active) setTargets(studentTargets);
        }
        if (isManager && section === 'configuracao') {
          const management = await psychologyService.listManagementCandidates(institutionId);
          if (active) setCandidates(management);
        }
        if (section === 'autorizacao' && !['STUDENT', 'GUARDIAN'].includes(role)) {
          throw new Error('NOT_AUTHORIZED');
        }
        if (enabled && ['agendar', 'agendamentos', 'chat', 'agenda', 'atendimentos', 'anotacoes', 'configuracao'].includes(section)) {
          const fromAt = new Date(localDateStartIso(appointmentsFrom));
          const throughAt = new Date(localDateStartIso(addDateDays(appointmentsThrough, 1)));
          if (appointmentsFrom > appointmentsThrough
            || throughAt <= fromAt
            || throughAt.getTime() - fromAt.getTime() > 90 * 86400000
            || throughAt.getTime() > Date.now() + 91 * 86400000) {
            setFeedback('Escolha um período válido de até 90 dias, encerrado no máximo em 90 dias a partir de hoje.');
            return;
          }
          const appointmentsData = await psychologyService.listAppointments(
            institutionId,
            fromAt.toISOString(),
            throughAt.toISOString(),
          );
          if (active) setAppointments(appointmentsData);
          if (role === 'STUDENT') {
            const ownTarget = studentTargets.find((target) => !target.is_minor || target.authorization_status === 'ACTIVE');
            if (ownTarget?.authorization_status === 'ACTIVE' && ['agendar', 'agendamentos'].includes(section)) {
              const available = await psychologyService.listAvailableSlots(institutionId, ownTarget.student_id, getLocalDateKey(new Date()));
              if (active) setSlots(available);
            }
          }
        }
        if (enabled && role === 'PSYCHOLOGIST' && section === 'disponibilidade') {
          const [rules, exceptions] = await Promise.all([
            psychologyService.listAvailability(institutionId, profileId),
            psychologyService.listAvailabilityBlocks(institutionId, profileId),
          ]);
          if (active) { setAvailability(rules); setBlocks(exceptions); }
        }
      } catch (error) {
        if (active) setFeedback(psychologyErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
          setLoadedContextKey(contextKey);
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [institutionId, profileId, contextKey, role, isManager, section, reloadKey, searchParams, appointmentsFrom, appointmentsThrough]);

  const isPageLoading = loading || loadedContextKey !== contextKey;

  const ownTarget = targets.find((target) => target.student_id && (role !== 'STUDENT' || target.authorization_status !== 'NONE')) ?? targets[0];
  const filteredSlots = useMemo(() => slots.filter((slot) => getLocalDateKey(new Date(slot.starts_at), slot.timezone) === slotDate), [slots, slotDate]);
  const activeAppointments = appointments.filter((appointment) => appointment.status === 'SCHEDULED');
  const selectedAppointment = appointments.find((appointment) => appointment.appointment_id === selectedAppointmentId) ?? null;
  const refresh = () => setReloadKey((value) => value + 1);
  const feedbackBox = feedback ? <p role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">{feedback}</p> : null;

  async function book(slot: PsychologySlot) {
    if (!ownTarget || !institutionId) return;
    const requestKey = `${ownTarget.student_id}:${slot.professional_profile_id}:${slot.starts_at}`;
    const idempotencyKey = bookingKeys.current.get(requestKey) ?? crypto.randomUUID();
    bookingKeys.current.set(requestKey, idempotencyKey);
    setBookingBusyKey(requestKey);
    try {
      await psychologyService.bookAppointment(institutionId, ownTarget.student_id, slot.professional_profile_id, slot.starts_at, idempotencyKey);
      bookingKeys.current.delete(requestKey);
      setFeedback('Consulta confirmada. O atendimento só começa quando a profissional abrir a sessão.');
      refresh();
    } catch (error) { setFeedback(psychologyErrorMessage(error)); }
    finally { setBookingBusyKey(null); }
  }

  function openChat(appointment: PsychologyAppointment) {
    setSelectedAppointmentId(appointment.appointment_id);
    navigate(`/psychology/chat?appointment=${encodeURIComponent(appointment.appointment_id)}`);
  }

  function openNote(appointment: PsychologyAppointment) {
    setSelectedAppointmentId(appointment.appointment_id);
    navigate(`/psychology/anotacoes?appointment=${encodeURIComponent(appointment.appointment_id)}`);
  }

  const pageHeading = sectionLabels[section] ?? 'Apoio psicológico';
  const authorizationPath = section === 'autorizacao';
  const clinicalFeatureSection = ['agendar', 'agendamentos', 'chat', 'agenda', 'atendimentos', 'anotacoes', 'disponibilidade'].includes(section);
  const canShowManagement = isManager && section === 'configuracao';
  const canShowStudentClinical = role === 'STUDENT' && ['agendar', 'agendamentos', 'chat'].includes(section);
  const canShowProfessionalClinical = role === 'PSYCHOLOGIST' && ['agenda', 'atendimentos', 'anotacoes', 'disponibilidade'].includes(section);
  const canShowAuthorization = authorizationPath && ['STUDENT', 'GUARDIAN'].includes(role);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 p-6 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Atendimento humano · acesso controlado</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Apoio psicológico</h1>
        <p className="mt-2 max-w-3xl text-sm text-blue-50">Agendamento, conversa privada e registros restritos, separados das informações acadêmicas.</p>
        <p className="mt-2 text-xs text-blue-100">O canal não é monitorado continuamente e não substitui atendimento de emergência.</p>
      </header>
      <SectionNav role={role} section={section} />
      {feedbackBox}
      {isPageLoading ? <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Carregando informações do módulo…</p> : null}
      {!isPageLoading && !institutionId ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Selecione uma instituição para continuar.</p> : null}
      {!isPageLoading && !moduleEnabled && clinicalFeatureSection ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-bold text-amber-950 dark:text-amber-100">Módulo ainda não habilitado</h2>
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-200">A escola ainda não habilitou o Apoio psicológico no servidor. Esta proteção bloqueia consultas e gravações também no banco. Fale com a equipe responsável pela instituição.</p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">O cadastro de profissionais e os vínculos operacionais podem ser preparados na configuração; o conteúdo clínico continua inacessível.</p>
        </section>
      ) : null}
      {!isPageLoading && canShowManagement && institutionId ? <ManagementPanel institutionId={institutionId} candidates={candidates} moduleEnabled={moduleEnabled} onRefresh={refresh} onFeedback={setFeedback} /> : null}
      {!isPageLoading && canShowAuthorization ? <AuthorizationPanel targets={targets} role={role} moduleEnabled={moduleEnabled} onRefresh={refresh} onFeedback={setFeedback} /> : null}

      {!isPageLoading && canShowStudentClinical && moduleEnabled && section === 'agendar' ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"><strong>Como funciona:</strong> escolha um horário com uma profissional habilitada. A consulta é confirmada no agendamento e a conversa começa quando a profissional iniciar o atendimento.</div>
          {ownTarget?.authorization_status !== 'ACTIVE' ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Antes de agendar, é necessária autorização. Estudantes adultos podem registrá-la em <Link className="font-bold underline" to="/psychology/autorizacao">Autorizações</Link>. Para menores, o cadastro exige ação do responsável legal vinculado.</p> : null}
          {ownTarget?.authorization_status === 'ACTIVE' ? (
            <>
              <label className="block max-w-xs text-sm font-semibold">Escolha uma data<select value={slotDate} onChange={(event) => setSlotDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-950">{[...new Set(slots.map((slot) => getLocalDateKey(new Date(slot.starts_at), slot.timezone)))].sort().map((date) => <option key={date} value={date}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone: BRAZIL_TIMEZONE }).format(new Date(`${date}T12:00:00`))}</option>)}</select></label>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredSlots.map((slot) => { const requestKey = `${ownTarget.student_id}:${slot.professional_profile_id}:${slot.starts_at}`; return <article key={`${slot.professional_profile_id}-${slot.starts_at}`} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p className="font-bold">{formatDateTime(slot.starts_at, slot.timezone)}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{slot.professional_name} · CRP {slot.crp_registration}/{slot.crp_state}</p><button type="button" disabled={bookingBusyKey !== null} onClick={() => void book(slot)} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{bookingBusyKey === requestKey ? 'Confirmando…' : 'Confirmar consulta'}</button></article>; })}</div>
              {!slots.length ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Não há horários disponíveis nos próximos 30 dias. Consulte novamente mais tarde.</p> : slots.length > 0 && !filteredSlots.length ? <p className="text-sm text-slate-600">Não há horários nesta data. Escolha outra data.</p> : null}
            </>
          ) : null}
        </section>
      ) : null}

      {!isPageLoading && canShowStudentClinical && moduleEnabled && section === 'agendamentos' ? (
        <section className="space-y-4"><div><h2 className="text-xl font-bold">Meus agendamentos</h2><p className="text-sm text-slate-600 dark:text-slate-300">Os horários são confirmados no servidor; cancelamento e remarcação respeitam o prazo configurado.</p></div>{activeAppointments.filter((appointment) => appointment.student_id === ownTarget?.student_id).map((appointment) => <AppointmentCard key={appointment.appointment_id} appointment={appointment} mode="student" onOpenChat={openChat} onOpenNote={openNote} onRefresh={refresh} onFeedback={setFeedback} slots={slots} />)}{!activeAppointments.some((appointment) => appointment.student_id === ownTarget?.student_id) ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-slate-600 dark:border-slate-700 dark:text-slate-300">Você ainda não tem atendimentos agendados neste período.</p> : null}</section>
      ) : null}

      {!isPageLoading && canShowStudentClinical && moduleEnabled && section === 'chat' ? (
        selectedAppointment && selectedAppointment.student_id === ownTarget?.student_id ? <ChatPanel appointment={selectedAppointment} profileId={profileId} role={role} /> : <section className="space-y-3"><h2 className="text-xl font-bold">Atendimentos disponíveis</h2>{activeAppointments.filter((appointment) => appointment.student_id === ownTarget?.student_id).map((appointment) => <AppointmentCard key={appointment.appointment_id} appointment={appointment} mode="student" onOpenChat={openChat} onOpenNote={openNote} onRefresh={refresh} onFeedback={setFeedback} slots={slots} />)}{!activeAppointments.some((appointment) => appointment.student_id === ownTarget?.student_id) ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">O chat aparecerá aqui quando houver um atendimento agendado.</p> : null}</section>
      ) : null}

      {!isPageLoading && canShowProfessionalClinical && moduleEnabled && section === 'disponibilidade' && institutionId ? <AvailabilityPanel institutionId={institutionId} profileId={profileId} rules={availability} blocks={blocks} onRefresh={refresh} onFeedback={setFeedback} /> : null}

      {!isPageLoading && canShowProfessionalClinical && moduleEnabled && ['agenda', 'atendimentos', 'anotacoes'].includes(section) ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">{section === 'agenda' ? 'Agenda profissional' : section === 'anotacoes' ? 'Registros clínicos' : 'Atendimentos'}</h2><p className="text-sm text-slate-600 dark:text-slate-300">A lista contém somente consultas atribuídas à profissional autenticada.</p></div><div className="flex gap-2"><label className="text-xs font-semibold">De<input type="date" value={appointmentsFrom} max={appointmentsThrough} onChange={(event) => setAppointmentsFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-xs font-semibold">Até<input type="date" value={appointmentsThrough} min={appointmentsFrom} max={addDateDays(getLocalDateKey(new Date()), 89)} onChange={(event) => setAppointmentsThrough(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-700 dark:bg-slate-950" /></label><button type="button" onClick={refresh} className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">Atualizar</button></div></div>
          {appointments.filter((appointment) => appointment.professional_profile_id === profileId && getLocalDateKey(new Date(appointment.starts_at)) >= appointmentsFrom && getLocalDateKey(new Date(appointment.starts_at)) <= appointmentsThrough).map((appointment) => <div key={appointment.appointment_id} className="space-y-3"><AppointmentCard appointment={appointment} mode="psychologist" onOpenChat={openChat} onOpenNote={openNote} onRefresh={refresh} onFeedback={setFeedback} slots={[]} />{section === 'anotacoes' || selectedAppointmentId === appointment.appointment_id ? <ClinicalNoteEditor key={appointment.session_id} appointment={appointment} /> : null}{section === 'atendimentos' && selectedAppointmentId === appointment.appointment_id ? <ChatPanel appointment={appointment} profileId={profileId} role={role} /> : null}</div>)}
          {!appointments.some((appointment) => appointment.professional_profile_id === profileId && getLocalDateKey(new Date(appointment.starts_at)) >= appointmentsFrom && getLocalDateKey(new Date(appointment.starts_at)) <= appointmentsThrough) ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhum atendimento atribuído nesse período.</p> : null}
        </section>
      ) : null}

      {!isPageLoading && isManager && moduleEnabled && section === 'configuracao' ? (
        <section className="space-y-4"><h2 className="text-xl font-bold">Visão operacional de agendamentos</h2><p className="text-sm text-slate-600 dark:text-slate-300">A equipe autorizada vê somente os metadados necessários à operação. Mensagens e anotações clínicas nunca são retornadas aqui.</p>{appointments.map((appointment) => <AppointmentCard key={appointment.appointment_id} appointment={appointment} mode="manager" onOpenChat={() => setFeedback('A administração não tem acesso ao chat clínico.')} onOpenNote={() => setFeedback('A administração não tem acesso às anotações clínicas.')} onRefresh={refresh} onFeedback={setFeedback} slots={[]} />)}{!appointments.length ? <p className="text-sm text-slate-500">Nenhum agendamento no período atual.</p> : null}</section>
      ) : null}

      {!isPageLoading && canShowProfessionalClinical && moduleEnabled && selectedAppointment && section === 'anotacoes' && !appointments.some((appointment) => appointment.appointment_id === selectedAppointment.appointment_id && appointment.professional_profile_id === profileId) ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">O atendimento selecionado não está atribuído a esta profissional.</p> : null}
      {!isPageLoading && !canShowManagement && !canShowAuthorization && !canShowStudentClinical && !canShowProfessionalClinical ? <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold">Acesso não disponível</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Este perfil não tem uma seção do Apoio psicológico habilitada nesta instituição.</p></section> : null}
      <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">Instituição: {currentInstitution?.name ?? '—'} · Perfil: {roleLabel(role)}. Registros clínicos não são enviados a ferramentas de análise nem ao cadastro acadêmico.</footer>
    </main>
  );
}

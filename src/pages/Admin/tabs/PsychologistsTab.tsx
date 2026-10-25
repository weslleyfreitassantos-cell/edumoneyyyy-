import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, Save, Search, UserRoundCog } from 'lucide-react';

import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentInstitution } from '../../../hooks/useCurrentInstitution';
import { isValidBrazilianState, isValidCrpRegistration } from './school-users/unifiedUserInviteModel';
import SchoolUsersTab from './SchoolUsersTab';
import {
  psychologyErrorMessage,
  psychologyService,
  type PsychologyProfessionalCandidate,
} from '../../../services/psychologyService';

const PAGE_SIZE = 10;

interface ProfessionalDraft {
  crp: string;
  state: string;
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function getVerificationLabel(professional: PsychologyProfessionalCandidate): string {
  if (!professional.registered) return 'CRP não cadastrado';
  if (professional.verification_status === 'SUSPENDED') return 'Suspenso';
  if (professional.verification_status === 'VERIFIED') {
    return professional.linked ? 'Verificado e habilitado nesta instituição' : 'Verificado; vínculo institucional inativo';
  }
  return 'Pendente de verificação humana';
}

export default function PsychologistsTab() {
  const { profile } = useAuth();
  const institutionQuery = useCurrentInstitution(profile?.id);
  const institutionId = institutionQuery.data ?? '';
  const [professionals, setProfessionals] = useState<PsychologyProfessionalCandidate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProfessionalDraft>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let current = true;
    if (!institutionId) {
      setProfessionals([]);
      return () => { current = false; };
    }

    setLoading(true);
    void psychologyService.listManagementCandidates(institutionId, { pageSize: 100 })
      .then((result) => {
        if (!current) return;
        setProfessionals(result.professionals);
        setDrafts(Object.fromEntries(result.professionals.map((professional) => [
          professional.profile_id,
          { crp: professional.crp_registration ?? '', state: professional.crp_state ?? '' },
        ])));
      })
      .catch((error: unknown) => {
        if (current) setFeedback({ type: 'error', text: psychologyErrorMessage(error) });
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => { current = false; };
  }, [institutionId, refreshKey]);

  const filteredProfessionals = useMemo(() => {
    const query = normalizeSearch(search);
    if (!query) return professionals;
    return professionals.filter((professional) => normalizeSearch([
      professional.full_name,
      professional.email,
      professional.crp_registration ?? '',
      professional.crp_state ?? '',
    ].join(' ')).includes(query));
  }, [professionals, search]);
  const pageCount = Math.max(1, Math.ceil(filteredProfessionals.length / PAGE_SIZE));
  const visibleProfessionals = filteredProfessionals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateDraft(profileId: string, field: keyof ProfessionalDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [profileId]: { crp: '', state: '', ...current[profileId], [field]: value },
    }));
  }

  async function saveRegistration(event: FormEvent<HTMLFormElement>, professional: PsychologyProfessionalCandidate) {
    event.preventDefault();
    const draft = drafts[professional.profile_id] ?? { crp: '', state: '' };
    if (!isValidCrpRegistration(draft.crp) || !isValidBrazilianState(draft.state)) {
      setFeedback({ type: 'error', text: 'Informe um CRP válido e uma UF brasileira válida.' });
      return;
    }

    setBusyProfileId(professional.profile_id);
    setFeedback(null);
    try {
      await psychologyService.registerProfessional(institutionId, professional.profile_id, draft.crp.trim(), draft.state.trim().toUpperCase());
      setFeedback({ type: 'success', text: `CRP de ${professional.full_name} salvo como pendente de verificação humana. O acesso clínico continua bloqueado.` });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFeedback({ type: 'error', text: psychologyErrorMessage(error) });
    } finally {
      setBusyProfileId(null);
    }
  }

  async function verifyRegistration(professional: PsychologyProfessionalCandidate) {
    setBusyProfileId(professional.profile_id);
    setFeedback(null);
    try {
      await psychologyService.verifyProfessional(institutionId, professional.profile_id);
      setFeedback({ type: 'success', text: `Verificação humana do CRP confirmada para ${professional.full_name}. O vínculo profissional foi habilitado somente nesta instituição.` });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFeedback({ type: 'error', text: psychologyErrorMessage(error) });
    } finally {
      setBusyProfileId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-center gap-2">
          <UserRoundCog className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Psicólogos da instituição</h2>
        </div>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          O convite cria a conta e o vínculo escolar. O CRP fica pendente até a conferência humana; só depois a habilitação institucional pode liberar funções clínicas.
        </p>
      </header>

      <SchoolUsersTab
        fixedRole="PSYCHOLOGIST"
        inviteTargets={['PSYCHOLOGIST']}
        inviteHeading="Cadastro de psicólogo(a)"
        onInviteComplete={() => setRefreshKey((value) => value + 1)}
      />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Registro profissional e habilitação</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pesquise pelo nome, e-mail ou CRP. Alterar um CRP verificado o devolve para revisão humana.</p>
        </div>

        {feedback && (
          <p role="status" className={`rounded-lg border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            {feedback.text}
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Pesquisar psicólogo
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} type="search" placeholder="Nome, e-mail ou CRP" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          </span>
        </label>

        {loading ? (
          <p role="status" className="flex items-center gap-2 rounded-lg border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Carregando profissionais…</p>
        ) : !institutionId ? (
          <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Selecione uma instituição ativa para gerenciar os registros profissionais.</p>
        ) : visibleProfessionals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhum psicólogo corresponde à pesquisa.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr><th className="px-4 py-3">Profissional</th><th className="px-4 py-3">CRP e UF</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {visibleProfessionals.map((professional) => {
                  const draft = drafts[professional.profile_id] ?? { crp: '', state: '' };
                  const busy = busyProfileId === professional.profile_id;
                  return (
                    <tr key={professional.profile_id}>
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900 dark:text-white">{professional.full_name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{professional.email}</p></td>
                      <td className="px-4 py-3">
                        <form id={`psychologist-registration-${professional.profile_id}`} onSubmit={(event) => void saveRegistration(event, professional)} className="flex items-end gap-2">
                          <label className="min-w-0 text-xs text-slate-600 dark:text-slate-300">CRP<input aria-label={`CRP de ${professional.full_name}`} value={draft.crp} onChange={(event) => updateDraft(professional.profile_id, 'crp', event.target.value)} maxLength={20} required className="mt-1 block w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" /></label>
                          <label className="text-xs text-slate-600 dark:text-slate-300">UF<input aria-label={`UF do CRP de ${professional.full_name}`} value={draft.state} onChange={(event) => updateDraft(professional.profile_id, 'state', event.target.value.toUpperCase().slice(0, 2))} maxLength={2} required className="mt-1 block w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase dark:border-slate-700 dark:bg-slate-950" /></label>
                          <button type="submit" form={`psychologist-registration-${professional.profile_id}`} aria-label={`Salvar CRP de ${professional.full_name}`} title="Salvar CRP" disabled={busy} className="rounded-md border border-slate-300 p-2 text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:text-blue-300">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${professional.verification_status === 'VERIFIED' && professional.linked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                          {professional.verification_status === 'VERIFIED' && professional.linked ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                          {getVerificationLabel(professional)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {professional.registered && professional.verification_status !== 'VERIFIED' ? (
                          <button type="button" disabled={busy} onClick={() => void verifyRegistration(professional)} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200">Confirmar verificação humana</button>
                        ) : <span className="text-xs text-slate-500 dark:text-slate-400">{professional.verification_status === 'VERIFIED' ? 'Habilitado' : 'Cadastre o CRP'}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredProfessionals.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <span>Página {page} de {pageCount} · {filteredProfessionals.length} profissionais</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Anterior</button>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700">Próxima</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

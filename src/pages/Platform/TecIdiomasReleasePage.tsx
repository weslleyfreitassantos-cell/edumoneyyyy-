import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Loader2, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { supabase } from '../../lib/supabaseClient';

const COURSES = [
  { code: 'TEC_ENGLISH_FOUNDATIONS', version: 1, label: 'Inglês · Primeiros passos' },
  { code: 'TEC_ENGLISH_FOUNDATIONS_V2', version: 4, label: 'Inglês · Conversação' },
  { code: 'TEC_ENGLISH_FOUNDATIONS_V2_EXPANSION', version: 1, label: 'Inglês · Continuação' },
  { code: 'TEC_ENGLISH_FOUNDATIONS_V4_BEGINNER', version: 1, label: 'Inglês · Iniciante' },
  { code: 'TEC_KOREAN_FOUNDATIONS_V1', version: 1, label: 'Coreano · Primeiros passos' },
  { code: 'TEC_KOREAN_FOUNDATIONS_V2_BEGINNER', version: 1, label: 'Coreano · Iniciante' },
  { code: 'TEC_SPANISH_FOUNDATIONS_V1', version: 1, label: 'Espanhol · Primeiros passos' },
  { code: 'TEC_SPANISH_FOUNDATIONS_V2_BEGINNER', version: 1, label: 'Espanhol · Iniciante' },
] as const;

interface ReleaseTarget {
  institution_id: string;
  institution_name: string;
  operational_status: string;
  enabled: boolean;
}

interface InstitutionReleaseRow {
  id: string;
  name: string;
  operationalStatus: string;
  courses: Array<(typeof COURSES)[number] & { enabled: boolean }>;
}

async function loadReleaseTargets(): Promise<InstitutionReleaseRow[]> {
  const results = await Promise.all(COURSES.map(async (course) => {
    const { data, error } = await supabase.rpc('get_tec_english_release_targets_v1', {
      p_course_code: course.code,
      p_content_version: course.version,
      p_search: null,
    });
    if (error) throw new Error('Não foi possível carregar as instituições elegíveis.');
    return { course, targets: (data ?? []) as ReleaseTarget[] };
  }));

  const rows = new Map<string, InstitutionReleaseRow>();
  for (const { course, targets } of results) {
    for (const target of targets) {
      const row = rows.get(target.institution_id) ?? {
        id: target.institution_id,
        name: target.institution_name,
        operationalStatus: target.operational_status,
        courses: [],
      };
      if (row.operationalStatus !== target.operational_status) {
        throw new Error('A situação operacional divergiu entre as consultas de cursos. Atualize a tela antes de continuar.');
      }
      row.courses.push({ ...course, enabled: target.enabled });
      rows.set(target.institution_id, row);
    }
  }

  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export default function TecIdiomasReleasePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const targets = useQuery({
    queryKey: ['tec-idiomas', 'institution-releases'],
    queryFn: loadReleaseTargets,
  });
  const changeRelease = useMutation({
    mutationFn: async (input: { course: (typeof COURSES)[number]; institutionId: string; enabled: boolean }) => {
      const { error } = await supabase.rpc('set_tec_english_institution_release_v1', {
        p_course_code: input.course.code,
        p_content_version: input.course.version,
        p_institution_id: input.institutionId,
        p_enabled: input.enabled,
      });
      if (error) throw new Error('A liberação não foi alterada. Confira seu acesso e tente novamente.');
      return input;
    },
    onSuccess: async (input) => {
      setFeedback(`${input.course.label}: ${input.enabled ? 'acesso habilitado' : 'acesso revogado'}.`);
      await queryClient.invalidateQueries({ queryKey: ['tec-idiomas', 'institution-releases'] });
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : 'Não foi possível alterar a liberação.'),
  });

  const filteredTargets = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (targets.data ?? []).filter((institution) => institution.name.toLocaleLowerCase('pt-BR').includes(term));
  }, [search, targets.data]);

  return (
    <main className="min-h-screen bg-[#f8f9fa] px-4 py-6 text-[#191c1d] sm:px-6 lg:px-8 dark:bg-[#0b1220] dark:text-[#f8fafc]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link to="/platform" className="inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#005bbf] hover:bg-[#eef3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:text-blue-300 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para instituições
        </Link>

        <header className="rounded-2xl bg-gradient-to-r from-[#075bb8] to-[#147cd3] p-6 text-white shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-7 w-7 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-100">Super Admin</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Acesso institucional · Tec Idiomas</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">Libere cursos para instituições operacionais. Contas canceladas, instituições suspensas e ambientes de teste não aparecem nesta lista.</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="eligible-institutions-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="eligible-institutions-heading" className="text-lg font-bold">Instituições elegíveis</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">A situação é validada no servidor antes de cada alteração.</p>
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              {targets.data?.length ?? '—'} instituições · {COURSES.length} cursos
            </div>
          </div>

          <label className="relative mt-5 block">
            <span className="sr-only">Buscar instituição elegível</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar instituição" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-950" />
          </label>

          {targets.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-600 dark:text-slate-300" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando instituições elegíveis…</div>
          ) : targets.isError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">Não foi possível consultar as instituições. Atualize a página ou confirme sua sessão de Super Admin.</div>
          ) : filteredTargets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhuma instituição elegível corresponde à busca.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {filteredTargets.map((institution) => {
                const enabledCount = institution.courses.filter((course) => course.enabled).length;
                const availableCount = institution.courses.length;
                const isExpanded = expanded === institution.id;
                return (
                  <article key={institution.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : institution.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 dark:hover:bg-slate-800/70">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{institution.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> Instituição ativa · conta {institution.operationalStatus === 'ACTIVE' ? 'ativa' : institution.operationalStatus.toLocaleLowerCase('pt-BR')}</span>
                          <span>{availableCount} cursos disponíveis</span>
                          <span>{enabledCount} habilitados</span>
                        </span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100">{enabledCount}/{availableCount}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    {isExpanded && (
                      <ul className="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                        {institution.courses.map((course) => (
                          <li key={course.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <span className="inline-flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-300" aria-hidden="true" />{course.label}</span>
                            <button type="button" onClick={() => changeRelease.mutate({ course, institutionId: institution.id, enabled: !course.enabled })} disabled={changeRelease.isPending} aria-label={`${course.enabled ? 'Revogar' : 'Habilitar'} ${course.label} para ${institution.name}`} className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${course.enabled ? 'border border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-600 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40' : 'bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-600'}`}>
                              {changeRelease.isPending ? 'Salvando…' : course.enabled ? 'Revogar' : 'Habilitar'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {feedback && <p className="mt-4 text-sm text-slate-700 dark:text-slate-200" role="status">{feedback}</p>}
        </section>

        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Cada liberação é registrada com o administrador responsável. Se uma instituição perder a elegibilidade, o acesso aos cursos é bloqueado sem apagar o histórico.</p>
      </div>
    </main>
  );
}

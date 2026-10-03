import { LockKeyhole, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  useLearningCanonicalSkills,
  useReviewTeacherPedagogicalItem,
  useTeacherPedagogicalReviews,
} from '../../hooks/useLearningCenter';
import { useInstitution } from '../../contexts/InstitutionContext';
import type { LearningPedagogicalReview } from '../../services/learningCenterService';
import { PedagogicalCenterHeader, PageState } from './PedagogicalCenterNav';

type ReviewDraft = Pick<LearningPedagogicalReview, 'state' | 'suggested_subject_area' | 'topic' | 'difficulty' | 'primary_canonical_skill_id' | 'explanation' | 'misconception' | 'confidence'>;

const draftFrom = (item: LearningPedagogicalReview): ReviewDraft => ({
  state: item.state,
  suggested_subject_area: item.suggested_subject_area,
  topic: item.topic,
  difficulty: item.difficulty,
  primary_canonical_skill_id: item.primary_canonical_skill_id,
  explanation: item.explanation,
  misconception: item.misconception,
  confidence: item.confidence,
});

export default function PedagogicalReviewQueuePage() {
  const { currentInstitutionId } = useInstitution();
  const queue = useTeacherPedagogicalReviews(currentInstitutionId ?? undefined);
  const skills = useLearningCanonicalSkills();
  const review = useReviewTeacherPedagogicalItem(currentInstitutionId ?? undefined);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const selected = queue.data?.find((item) => item.id === selectedId) ?? queue.data?.[0];

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setDraft(draftFrom(selected));
  }, [selected]);

  const save = () => {
    if (!selected || !draft) return;
    review.mutate({
      reviewId: selected.id,
      state: draft.state,
      suggestedSubjectArea: draft.suggested_subject_area ?? '',
      topic: draft.topic ?? '',
      difficulty: draft.difficulty,
      primaryCanonicalSkillId: draft.primary_canonical_skill_id,
      explanation: draft.explanation ?? '',
      misconception: draft.misconception ?? '',
      confidence: draft.confidence,
    });
  };

  return <div className="space-y-6">
    <PedagogicalCenterHeader subtitle="Revise classificações sem alterar a fonte oficial das questões." />
    {queue.isLoading ? <PageState>Carregando fila de revisão...</PageState> : queue.isError ? <PageState error>Não foi possível carregar a fila de revisão.</PageState> : !queue.data?.length ? <PageState>Nenhuma questão ENEM aguardando revisão nesta instituição.</PageState> : <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section aria-label="Fila de revisão pedagógica" className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold dark:text-white">Fila de revisão</h2><p className="mt-1 text-xs text-slate-500">{queue.data.length} item(ns) carregado(s)</p></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Revisão humana</span></div><div className="mt-4 space-y-2">{queue.data.map((item) => <button type="button" key={item.id} onClick={() => { setSelectedId(item.id); setDraft(draftFrom(item)); }} className={`w-full rounded-lg border p-3 text-left transition hover:border-[#005bbf] ${item.id === selected?.id ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/30' : 'dark:border-slate-700'}`}><p className="line-clamp-2 text-sm font-semibold dark:text-white">{item.statement}</p><p className="mt-1 text-xs text-slate-500">{item.source_year ?? 'Ano não informado'} · {item.source_name ?? 'ENEM'} · {item.confidence}</p></button>)}</div></section>
      {selected && draft ? <section aria-label="Revisão da questão selecionada" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Questão selecionada</p><h2 className="mt-1 font-bold dark:text-white">{selected.source_name ?? 'ENEM'} · {selected.source_year ?? 'ano não informado'}</h2></div><LockKeyhole className="h-5 w-5 text-slate-400" aria-label="Campos oficiais bloqueados" /></div><div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"><p className="text-sm font-semibold dark:text-white">{selected.statement}</p><ol className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">{selected.source_options.map((option, index) => <li key={`${index}-${option}`}>{String.fromCharCode(65 + index)}) {option}</li>)}</ol><p className="mt-3 text-xs text-slate-500">Resposta oficial: {JSON.stringify(selected.official_answer)} · fonte: {selected.source_reference ?? 'não informada'}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold dark:text-white">Área sugerida<input value={draft.suggested_subject_area ?? ''} onChange={(event) => setDraft({ ...draft, suggested_subject_area: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="text-sm font-semibold dark:text-white">Tópico<input value={draft.topic ?? ''} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="text-sm font-semibold dark:text-white">Dificuldade<select value={draft.difficulty ?? ''} onChange={(event) => setDraft({ ...draft, difficulty: (event.target.value || null) as ReviewDraft['difficulty'] })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Não classificada</option><option value="EASY">Fácil</option><option value="MEDIUM">Média</option><option value="HARD">Difícil</option></select></label><label className="text-sm font-semibold dark:text-white">Habilidade principal<select value={draft.primary_canonical_skill_id ?? ''} onChange={(event) => setDraft({ ...draft, primary_canonical_skill_id: event.target.value || null })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Não mapeada</option>{(skills.data ?? []).map((skill) => <option key={skill.id} value={skill.id}>{skill.subject_area ? `${skill.subject_area} · ` : ''}{skill.title}</option>)}</select></label><label className="text-sm font-semibold dark:text-white">Confiança<select value={draft.confidence} onChange={(event) => setDraft({ ...draft, confidence: event.target.value as ReviewDraft['confidence'] })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="HIGH">Alta</option><option value="MEDIUM">Média</option><option value="LOW">Baixa</option><option value="UNMAPPED">Não mapeada</option></select></label><label className="text-sm font-semibold dark:text-white">Estado<select value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value as ReviewDraft['state'] })} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="HUMAN_REVIEW_PENDING">Pendente</option><option value="HUMAN_REVIEWED">Revisada</option><option value="NEEDS_CORRECTION">Precisa correção</option></select></label></div><label className="mt-3 block text-sm font-semibold dark:text-white">Explicação pedagógica<textarea value={draft.explanation ?? ''} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Rascunho TecEscola, sem atribuir autoria ao INEP" /></label><label className="mt-3 block text-sm font-semibold dark:text-white">Observação sobre distrator<textarea value={draft.misconception ?? ''} onChange={(event) => setDraft({ ...draft, misconception: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Use somente quando houver evidência suficiente" /></label><button type="button" onClick={save} disabled={review.isPending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{review.isPending ? 'Salvando...' : 'Salvar revisão'}</button>{review.isSuccess ? <p role="status" className="mt-2 text-sm text-emerald-700">Revisão salva e auditada.</p> : null}{review.isError ? <p role="alert" className="mt-2 text-sm text-red-700">Não foi possível salvar esta revisão.</p> : null}</section> : null}
    </div>}
  </div>;
}

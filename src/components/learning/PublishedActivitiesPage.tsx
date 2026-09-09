import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { learningCenterKeys, useTeacherLearningActivities } from '../../hooks/useLearningCenter';
import type { LearningActivity } from '../../services/learningCenterService';
import { learningCenterService } from '../../services/learningCenterService';

interface ActivityEditDraft {
  title: string;
  description: string;
  activityType: 'PRACTICE' | 'REINFORCEMENT';
  question: string;
  options: string;
  correct: string;
  explanation: string;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  const serialized = JSON.stringify(value);
  return serialized === undefined ? '' : serialized;
}

function subjectLabel(activity: LearningActivity): string {
  const subject = Array.isArray(activity.subjects)
    ? activity.subjects[0]
    : activity.subjects;
  return subject?.name ?? 'Disciplina não informada';
}

function classLabel(activity: LearningActivity): string {
  const names = (activity.learning_assignments ?? []).map((assignment) => {
    const classRecord = Array.isArray(assignment.classes)
      ? assignment.classes[0]
      : assignment.classes;
    return classRecord?.name;
  }).filter((name): name is string => Boolean(name));

  return names.length ? names.join(', ') : 'Nenhuma turma vinculada';
}

function formatDate(value?: string): string {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value));
}

function toEditDraft(activity: LearningActivity): ActivityEditDraft {
  const question = activity.learning_questions?.[0];
  return {
    title: activity.title,
    description: activity.description ?? '',
    activityType: activity.activity_type === 'REINFORCEMENT' ? 'REINFORCEMENT' : 'PRACTICE',
    question: question?.question_text ?? '',
    options: (question?.options_json ?? []).join('\n'),
    correct: textValue(question?.correct_answer_json),
    explanation: question?.explanation ?? '',
  };
}

export default function PublishedActivitiesPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LearningActivity | null>(null);
  const [editDraft, setEditDraft] = useState<ActivityEditDraft | null>(null);
  const [assigning, setAssigning] = useState<LearningActivity | null>(null);
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [message, setMessage] = useState('');

  const activities = useTeacherLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const publishedActivities = (activities.data ?? []).filter((activity) => activity.status === 'PUBLISHED');
  const assignmentClasses = useQuery({
    queryKey: ['learning-center', 'repair-classes', currentInstitutionId, profile?.id, assigning?.subject_id],
    queryFn: () => learningCenterService.teacherClassesForSubject(currentInstitutionId!, profile!.id, assigning!.subject_id),
    enabled: Boolean(currentInstitutionId && profile?.id && assigning),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ activity, draft }: { activity: LearningActivity; draft: ActivityEditDraft }) => {
      const updated = await learningCenterService.updateActivity({
        activity_id: activity.id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        activity_type: draft.activityType,
        question_text: draft.question.trim(),
        options_json: draft.options.split('\n').map((item) => item.trim()).filter(Boolean),
        correct_answer_json: draft.correct.trim(),
        explanation: draft.explanation.trim(),
      });
      return updated;
    },
    onSuccess: () => {
      setEditing(null);
      setEditDraft(null);
      setMessage('Atividade atualizada com sucesso.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Não foi possível editar a atividade.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (activityId: string) => learningCenterService.deleteActivity(activityId),
    onSuccess: () => {
      setMessage('Atividade excluída com sucesso.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a atividade.');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assigning || !assignmentClassId) throw new Error('Selecione uma turma.');
      return learningCenterService.publishAndAssignActivity({
        activity_id: assigning.id,
        class_id: assignmentClassId,
      });
    },
    onSuccess: () => {
      setAssigning(null);
      setAssignmentClassId('');
      setMessage('Atividade vinculada à turma. Agora ela já pode ser iniciada pelos alunos.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Não foi possível vincular a atividade.');
    },
  });

  const openEdit = (activity: LearningActivity) => {
    setMessage('');
    setEditing(activity);
    setEditDraft(toEditDraft(activity));
  };

  const openAssignment = (activity: LearningActivity) => {
    setMessage('');
    setAssignmentClassId('');
    setAssigning(activity);
  };

  const removeActivity = (activity: LearningActivity) => {
    const confirmed = window.confirm(
      `Excluir definitivamente a atividade “${activity.title}”? As perguntas, atribuições e respostas relacionadas também serão removidas.`,
    );
    if (confirmed) deleteMutation.mutate(activity.id);
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editing && editDraft) updateMutation.mutate({ activity: editing, draft: editDraft });
  };

  return (
    <div className="space-y-6">
      <header>
        <Link to="/teacher/pedagogical-center" className="inline-flex items-center gap-2 text-sm font-semibold text-[#005bbf]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Central Pedagógica
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <BookOpenCheck className="h-7 w-7 text-[#005bbf]" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Professor</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Atividades publicadas</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Consulte, edite ou exclua as atividades que você publicou para suas turmas.
        </p>
      </header>

      {message ? <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">{message}</p> : null}

      {activities.isLoading ? (
        <section role="status" className="grid min-h-56 place-items-center rounded-xl border bg-white p-8 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin text-[#005bbf]" aria-hidden="true" />Carregando atividades...</span>
        </section>
      ) : activities.isError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não foi possível carregar suas atividades publicadas.
        </section>
      ) : publishedActivities.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 font-bold dark:text-white">Nenhuma atividade publicada</h2>
          <p className="mt-2 text-sm text-slate-500">As atividades publicadas por você aparecerão nesta página.</p>
          <Link to="/teacher/pedagogical-center" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white">
            <Save className="h-4 w-4" aria-hidden="true" />Criar atividade
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {publishedActivities.map((activity) => (
            <article key={activity.id} className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300">
                    <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-bold text-slate-900 dark:text-white">{activity.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-[#005bbf]">{subjectLabel(activity)}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Publicada</span>
              </div>

              <p className="mt-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{activity.description ?? 'Sem descrição cadastrada.'}</p>
              <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 dark:text-slate-400">
                <span>{activity.learning_questions?.length ?? 0} questão(ões)</span>
                <span>Publicada em {formatDate(activity.created_at)}</span>
                <span className="inline-flex items-center gap-1 sm:col-span-2"><UsersRound className="h-3.5 w-3.5" aria-hidden="true" />{classLabel(activity)}</span>
              </div>
              {!activity.learning_assignments?.length ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  Esta atividade está publicada, mas ainda não foi vinculada a uma turma.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2 border-t pt-4 dark:border-slate-700">
                {!activity.learning_assignments?.length ? (
                  <button type="button" onClick={() => openAssignment(activity)} disabled={assignMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-sm font-bold text-white hover:bg-[#004a9c] disabled:opacity-50">
                    <UsersRound className="h-4 w-4" aria-hidden="true" />Vincular turma
                  </button>
                ) : null}
                <button type="button" onClick={() => openEdit(activity)} disabled={updateMutation.isPending || deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-[#005bbf] px-3 py-2 text-sm font-bold text-[#005bbf] hover:bg-blue-50 disabled:opacity-50">
                  <Edit3 className="h-4 w-4" aria-hidden="true" />Editar
                </button>
                <button type="button" onClick={() => removeActivity(activity)} disabled={deleteMutation.isPending || updateMutation.isPending} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}Excluir
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {editing && editDraft ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="edit-learning-activity-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#005bbf]">Editar atividade</p>
                <h2 id="edit-learning-activity-title" className="mt-1 text-xl font-bold dark:text-white">{editing.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{subjectLabel(editing)} · {classLabel(editing)}</p>
              </div>
              <button type="button" onClick={() => { setEditing(null); setEditDraft(null); }} aria-label="Fechar edição" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold dark:text-white">Título
                  <input required value={editDraft.title} onChange={(event) => setEditDraft((current) => current ? { ...current, title: event.target.value } : current)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </label>
                <label className="text-sm font-semibold dark:text-white">Tipo
                  <select value={editDraft.activityType} onChange={(event) => setEditDraft((current) => current ? { ...current, activityType: event.target.value as ActivityEditDraft['activityType'] } : current)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="PRACTICE">Prática</option>
                    <option value="REINFORCEMENT">Reforço</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold dark:text-white">Descrição
                <textarea value={editDraft.description} onChange={(event) => setEditDraft((current) => current ? { ...current, description: event.target.value } : current)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="block text-sm font-semibold dark:text-white">Pergunta
                <textarea required value={editDraft.question} onChange={(event) => setEditDraft((current) => current ? { ...current, question: event.target.value } : current)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold dark:text-white">Opções (uma por linha)
                  <textarea required value={editDraft.options} onChange={(event) => setEditDraft((current) => current ? { ...current, options: event.target.value } : current)} rows={4} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </label>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold dark:text-white">Resposta correta
                    <input required value={editDraft.correct} onChange={(event) => setEditDraft((current) => current ? { ...current, correct: event.target.value } : current)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <label className="block text-sm font-semibold dark:text-white">Explicação
                    <textarea value={editDraft.explanation} onChange={(event) => setEditDraft((current) => current ? { ...current, explanation: event.target.value } : current)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4 dark:border-slate-700">
                <button type="button" onClick={() => { setEditing(null); setEditDraft(null); }} disabled={updateMutation.isPending} className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancelar</button>
                <button type="submit" disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {assigning ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="assign-learning-activity-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#005bbf]">Atribuir atividade</p>
                <h2 id="assign-learning-activity-title" className="mt-1 text-xl font-bold dark:text-white">Liberar para uma turma</h2>
                <p className="mt-1 text-sm text-slate-500">{assigning.title} · {subjectLabel(assigning)}</p>
              </div>
              <button type="button" onClick={() => { setAssigning(null); setAssignmentClassId(''); }} aria-label="Fechar atribuição" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              Depois de vincular a turma, a atividade aparecerá automaticamente em Práticas recomendadas para os alunos matriculados.
            </p>

            <label className="mt-5 block text-sm font-semibold dark:text-white">Turma
              {assignmentClasses.isLoading ? (
                <span className="mt-2 flex items-center gap-2 text-sm font-normal text-slate-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Carregando turmas...</span>
              ) : assignmentClasses.isError ? (
                <span className="mt-2 block text-sm font-normal text-red-600">Não foi possível carregar as turmas vinculadas à disciplina.</span>
              ) : (
                <select required value={assignmentClassId} onChange={(event) => setAssignmentClassId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">Selecione uma turma</option>
                  {(assignmentClasses.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              )}
            </label>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-4 dark:border-slate-700">
              <button type="button" onClick={() => { setAssigning(null); setAssignmentClassId(''); }} disabled={assignMutation.isPending} className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancelar</button>
              <button type="button" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || assignmentClasses.isLoading || !assignmentClassId} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UsersRound className="h-4 w-4" aria-hidden="true" />}
                {assignMutation.isPending ? 'Vinculando...' : 'Vincular e liberar'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

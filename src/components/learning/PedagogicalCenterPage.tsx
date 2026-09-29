import {
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Plus,
  Save,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { useTeacherAdaptiveInsights } from '../../hooks/useAdaptiveLearning';
import {
  learningCenterKeys,
  useLearningSkills,
  useLearningUnits,
  useTeacherLearningActivities,
  useTeacherLearningClasses,
  useTeacherLearningAttempts,
  useTeacherLearningCollections,
  useLearningPackages,
  useAssignLearningPackage,
  useTeacherQuestionBank,
} from '../../hooks/useLearningCenter';
import { learningCenterService } from '../../services/learningCenterService';

interface ActivityDraft {
  subjectId: string;
  classId: string;
  unitId: string;
  skillId: string;
  newUnitTitle: string;
  newSkillTitle: string;
  title: string;
  question: string;
  options: string;
  correct: string;
  explanation: string;
  activityType: 'PRACTICE' | 'REINFORCEMENT';
}

interface AdditionalQuestionDraft {
  question: string;
  options: string;
  correct: string;
  explanation: string;
}

const emptyDraft: ActivityDraft = {
  subjectId: '',
  classId: '',
  unitId: '',
  skillId: '',
  newUnitTitle: '',
  newSkillTitle: '',
  title: '',
  question: '',
  options: '',
  correct: '',
  explanation: '',
  activityType: 'PRACTICE',
};

function studentName(attempt: {
  students?: {
    profiles?: { full_name: string } | { full_name: string }[] | null;
  } | {
    profiles?: { full_name: string } | { full_name: string }[] | null;
  }[] | null;
}) {
  const student = Array.isArray(attempt.students)
    ? attempt.students[0]
    : attempt.students;
  const profile = Array.isArray(student?.profiles)
    ? student.profiles[0]
    : student?.profiles;
  return profile?.full_name ?? 'Aluno';
}

function activityTitle(attempt: {
  learning_activities?: { title: string } | { title: string }[] | null;
}) {
  const activity = Array.isArray(attempt.learning_activities)
    ? attempt.learning_activities[0]
    : attempt.learning_activities;
  return activity?.title ?? 'Atividade';
}

export default function PedagogicalCenterPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ActivityDraft>(emptyDraft);
  const [additionalQuestions, setAdditionalQuestions] = useState<AdditionalQuestionDraft[]>([]);
  const [message, setMessage] = useState('');
  const [collectionSubjectId, setCollectionSubjectId] = useState('');
  const [collectionClassId, setCollectionClassId] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionUrl, setCollectionUrl] = useState('');
  const [collectionResourceTitle, setCollectionResourceTitle] = useState('');

  const subjects = useQuery({
    queryKey: ['learning-center', 'teacher-subjects', currentInstitutionId, profile?.id],
    queryFn: () => learningCenterService.teacherSubjects(currentInstitutionId!, profile!.id),
    enabled: Boolean(currentInstitutionId && profile?.id),
  });
  const classes = useQuery({
    queryKey: ['learning-center', 'teacher-classes', currentInstitutionId, profile?.id, draft.subjectId],
    queryFn: () => learningCenterService.teacherClassesForSubject(currentInstitutionId!, profile!.id, draft.subjectId),
    enabled: Boolean(currentInstitutionId && profile?.id && draft.subjectId),
  });
  const collectionClasses = useQuery({
    queryKey: ['learning-center', 'collection-classes', currentInstitutionId, profile?.id, collectionSubjectId],
    queryFn: () => learningCenterService.teacherClassesForSubject(currentInstitutionId!, profile!.id, collectionSubjectId),
    enabled: Boolean(currentInstitutionId && profile?.id && collectionSubjectId),
  });
  const units = useLearningUnits(currentInstitutionId ?? undefined, draft.subjectId);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, draft.unitId);
  const activities = useTeacherLearningActivities(currentInstitutionId ?? undefined, profile?.id);
  const attempts = useTeacherLearningAttempts(currentInstitutionId ?? undefined, profile?.id);
  const collections = useTeacherLearningCollections(currentInstitutionId ?? undefined, profile?.id);
  const adaptiveInsights = useTeacherAdaptiveInsights(currentInstitutionId ?? undefined);
  const questionBank = useTeacherQuestionBank(currentInstitutionId ?? undefined);
  const packages = useLearningPackages(currentInstitutionId ?? undefined);
  const teacherClasses = useTeacherLearningClasses(profile?.id);
  const assignPackage = useAssignLearningPackage(currentInstitutionId ?? undefined);
  const [packageId, setPackageId] = useState('');
  const [packageClassId, setPackageClassId] = useState('');

  const create = useMutation({
    mutationFn: async (input: ActivityDraft) => {
      let unitId = input.unitId || undefined;
      if (!unitId && input.newUnitTitle.trim()) {
        const unit = await learningCenterService.createUnit({
          institution_id: currentInstitutionId!,
          subject_id: input.subjectId,
          title: input.newUnitTitle.trim(),
        });
        unitId = unit.id;
      }

      let skillId = input.skillId || undefined;
      if (unitId && !skillId && input.newSkillTitle.trim()) {
        const skill = await learningCenterService.createSkill({
          institution_id: currentInstitutionId!,
          unit_id: unitId,
          title: input.newSkillTitle.trim(),
        });
        skillId = skill.id;
      }

      const activity = await learningCenterService.createActivityWithQuestions({
        institution_id: currentInstitutionId!,
        subject_id: input.subjectId,
        unit_id: unitId,
        skill_id: skillId,
        teacher_id: profile!.id,
        title: input.title.trim(),
        description: input.explanation.trim() || 'Prática criada pela Central Pedagógica.',
        activity_type: input.activityType,
        questions: [
          {
            question_text: input.question.trim(),
            question_type: 'MULTIPLE_CHOICE',
            options_json: input.options.split('\n').map((item) => item.trim()).filter(Boolean),
            correct_answer_json: input.correct.trim(),
            explanation: input.explanation.trim() || null,
            points: 1,
            sort_order: 0,
          },
          ...additionalQuestions.map((question, index) => ({
            question_text: question.question.trim(),
            question_type: 'MULTIPLE_CHOICE' as const,
            options_json: question.options.split('\n').map((item) => item.trim()).filter(Boolean),
            correct_answer_json: question.correct.trim(),
            explanation: question.explanation.trim() || null,
            points: 1,
            sort_order: index + 1,
          })),
        ],
      });
      await learningCenterService.publishAndAssignActivity({
        activity_id: activity.id,
        class_id: input.classId,
      });
      return activity;
    },
    onSuccess: () => {
      setDraft(emptyDraft);
      setAdditionalQuestions([]);
      setMessage('Atividade publicada e atribuída à turma com sucesso.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a atividade.');
    },
  });

  const createCollection = useMutation({
    mutationFn: async () => {
      const collection = await learningCenterService.createCollection({
        institution_id: currentInstitutionId!,
        subject_id: collectionSubjectId,
        class_id: collectionClassId,
        teacher_id: profile!.id,
        title: collectionTitle.trim(),
        description: collectionDescription.trim() || undefined,
      });
      if (collectionUrl.trim()) {
        await learningCenterService.createResource({
          institution_id: currentInstitutionId!,
          collection_id: collection.id,
          title: collectionResourceTitle.trim() || 'Abrir recurso oficial',
          provider: 'Fonte oficial',
          resource_type: 'LINK',
          source_url: collectionUrl.trim(),
        });
      }
      return collection;
    },
    onSuccess: () => {
      setCollectionSubjectId('');
      setCollectionClassId('');
      setCollectionTitle('');
      setCollectionDescription('');
      setCollectionUrl('');
      setCollectionResourceTitle('');
      setMessage('Coleção publicada para a turma com sucesso.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a coleção.');
    },
  });

  const update = <K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === 'subjectId') setDraft((current) => ({ ...current, classId: '', unitId: '', skillId: '' }));
    if (key === 'unitId') setDraft((current) => ({ ...current, skillId: '' }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    create.mutate(draft);
  };

  const addQuestion = () => {
    setAdditionalQuestions((questions) => [...questions, { question: '', options: '', correct: '', explanation: '' }]);
  };

  const useBankQuestion = (questionId: string) => {
    const item = questionBank.data?.find((question) => question.id === questionId);
    if (!item) return;
    setDraft((current) => ({
      ...current,
      question: item.statement,
      options: item.options.join('\n'),
      correct: typeof item.correct_answer === 'string' ? item.correct_answer : JSON.stringify(item.correct_answer),
      explanation: item.explanation ?? '',
    }));
    setMessage('Questão carregada do banco. Revise e publique com o contexto da sua turma.');
  };

  const updateAdditionalQuestion = <K extends keyof AdditionalQuestionDraft>(index: number, key: K, value: AdditionalQuestionDraft[K]) => {
    setAdditionalQuestions((questions) => questions.map((question, questionIndex) => questionIndex === index ? { ...question, [key]: value } : question));
  };

  const lowPerformance = (attempts.data ?? []).filter((item) =>
    item.total_points > 0 && item.score / item.total_points < 0.6,
  );

  const assignSelectedPackage = () => {
    if (!packageId || !packageClassId) return;
    assignPackage.mutate({ packageId, classId: packageClassId }, {
      onSuccess: () => setMessage('Trilha atribuída à turma com sucesso.'),
      onError: (error) => setMessage(error instanceof Error ? error.message : 'Não foi possível atribuir a trilha.'),
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-[#005bbf]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Professor</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Central Pedagógica</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Crie práticas, atribua para suas turmas e acompanhe quem precisa de reforço.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Link to="/teacher/pedagogical-center/activities" aria-label="Abrir atividades publicadas" className="block rounded-xl border bg-white p-5 shadow-sm transition hover:border-[#005bbf] hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
          <BarChart3 className="h-6 w-6 text-[#005bbf]" />
          <h2 className="mt-3 font-bold dark:text-white">Atividades publicadas</h2>
          <p className="mt-2 text-2xl font-bold dark:text-white">{activities.data?.filter((activity) => activity.status === 'PUBLISHED').length ?? 0}</p>
        </Link>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <UsersRound className="h-6 w-6 text-amber-500" />
          <h2 className="mt-3 font-bold dark:text-white">Respostas recebidas</h2>
          <p className="mt-2 text-2xl font-bold dark:text-white">{attempts.data?.length ?? 0}</p>
        </article>
        <article className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-3 font-bold dark:text-white">Precisam de atenção</h2>
          <p className="mt-2 text-2xl font-bold dark:text-white">{lowPerformance.length}</p>
        </article>
      </section>

      <section
        aria-label="Aprendizagem adaptativa"
        className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30"
      >
        <div className="flex items-start gap-3">
          <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-[#005bbf]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-blue-950 dark:text-blue-100">Aprendizagem adaptativa</h2>
            <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
              Lacunas confirmadas e pontos que podem precisar de diagnóstico nas suas turmas.
            </p>
            {adaptiveInsights.isLoading ? (
              <p className="mt-3 text-sm text-blue-800 dark:text-blue-300">Carregando sinais de aprendizagem...</p>
            ) : adaptiveInsights.data?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {adaptiveInsights.data.map((insight) => (
                  <article key={`${insight.canonicalSkillId}-${insight.state}`} className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-blue-950/50">
                    <p className="font-semibold text-slate-900 dark:text-white">{insight.skillTitle}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {insight.diagnosticNeededCount} aluno(s) precisam de diagnóstico
                    </p>
                    <p className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {insight.studentCount} aluno(s) · {insight.state === 'NEEDS_REVIEW' ? 'lacuna confirmada' : 'em acompanhamento'}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-blue-800 dark:text-blue-300">
                Ainda não há evidências suficientes para gerar um sinal adaptativo.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Banco de questões" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Banco de questões</h2>
            <p className="mt-1 text-sm text-slate-500">Reutilize questões TecEscola e ENEM sem copiar gabaritos para o aluno.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{questionBank.data?.length ?? 0}</span>
        </div>
        {questionBank.data?.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{questionBank.data.slice(0, 6).map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-semibold dark:text-white">{item.statement}</p><button type="button" onClick={() => useBankQuestion(item.id)} className="shrink-0 text-xs font-bold text-[#005bbf]">Usar</button></div><p className="mt-2 text-xs text-slate-500">{item.package_type} · {item.subject_area}{item.difficulty ? ` · ${item.difficulty}` : ''}</p></article>)}</div> : <p className="mt-4 text-sm text-slate-500">O banco aparecerá quando houver questões publicadas para sua instituição.</p>}
      </section>

      <section aria-label="Trilhas e pacotes" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Trilhas e pacotes</h2>
            <p className="mt-1 text-sm text-slate-500">Atribua uma sequência pronta sem alterar o domínio manualmente.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{packages.data?.length ?? 0}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold dark:text-white">Pacote
            <select value={packageId} onChange={(event) => setPackageId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Selecione uma trilha</option>
              {packages.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold dark:text-white">Turma
            <select value={packageClassId} onChange={(event) => setPackageClassId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Selecione uma turma</option>
              {teacherClasses.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <button type="button" disabled={!packageId || !packageClassId || assignPackage.isPending} onClick={assignSelectedPackage} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {assignPackage.isPending ? 'Atribuindo...' : 'Atribuir trilha'}
        </button>
      </section>

      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold dark:text-white">Nova atividade</h2>
            <p className="mt-1 text-sm text-slate-500">Uma prática simples para começar o ciclo professor → aluno.</p>
          </div>
          <select value={draft.activityType} onChange={(event) => update('activityType', event.target.value as ActivityDraft['activityType'])} className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
            <option value="PRACTICE">Prática</option>
            <option value="REINFORCEMENT">Reforço</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold dark:text-white">Matéria
            <select required value={draft.subjectId} onChange={(event) => update('subjectId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Selecione</option>
              {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold dark:text-white">Turma
            <select required value={draft.classId} onChange={(event) => update('classId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Selecione</option>
              {classes.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold dark:text-white">Unidade
            <select value={draft.unitId} onChange={(event) => update('unitId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Sem unidade ou criar abaixo</option>
              {units.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <input value={draft.newUnitTitle} onChange={(event) => update('newUnitTitle', event.target.value)} placeholder="Nova unidade (opcional)" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-semibold dark:text-white">Habilidade
            <select value={draft.skillId} onChange={(event) => update('skillId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Sem habilidade ou criar abaixo</option>
              {skills.data?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <input value={draft.newSkillTitle} onChange={(event) => update('newSkillTitle', event.target.value)} placeholder="Nova habilidade (opcional)" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="block text-sm font-semibold dark:text-white">Título
          <input required value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Ex.: Revisão de frações" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold dark:text-white">Pergunta
          <textarea required value={draft.question} onChange={(event) => update('question', event.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold dark:text-white">Opções (uma por linha)
            <textarea required value={draft.options} onChange={(event) => update('options', event.target.value)} rows={4} placeholder={'1/2\n1/3\n2/3'} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <div className="space-y-3">
            <label className="block text-sm font-semibold dark:text-white">Resposta correta
              <input required value={draft.correct} onChange={(event) => update('correct', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
            <label className="block text-sm font-semibold dark:text-white">Explicação (opcional)
              <textarea value={draft.explanation} onChange={(event) => update('explanation', event.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </label>
          </div>
        </div>
        {additionalQuestions.map((question, index) => (
          <fieldset key={`question-${index}`} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-1 text-sm font-bold dark:text-white">Questão {index + 2}</legend>
            <textarea required value={question.question} onChange={(event) => updateAdditionalQuestion(index, 'question', event.target.value)} rows={3} placeholder="Enunciado" className="w-full rounded-lg border px-3 py-2" />
            <div className="grid gap-3 md:grid-cols-2">
              <textarea required value={question.options} onChange={(event) => updateAdditionalQuestion(index, 'options', event.target.value)} rows={4} placeholder={'Opções, uma por linha'} className="w-full rounded-lg border px-3 py-2" />
              <div className="space-y-3">
                <input required value={question.correct} onChange={(event) => updateAdditionalQuestion(index, 'correct', event.target.value)} placeholder="Resposta correta" className="w-full rounded-lg border px-3 py-2" />
                <textarea value={question.explanation} onChange={(event) => updateAdditionalQuestion(index, 'explanation', event.target.value)} rows={2} placeholder="Explicação opcional" className="w-full rounded-lg border px-3 py-2" />
              </div>
            </div>
            <button type="button" onClick={() => setAdditionalQuestions((questions) => questions.filter((_, questionIndex) => questionIndex !== index))} className="text-sm font-bold text-red-600">Remover questão</button>
          </fieldset>
        ))}
        <button type="button" onClick={addQuestion} className="inline-flex items-center gap-2 rounded-lg border border-[#005bbf] px-3 py-2 text-sm font-bold text-[#005bbf]">
          <Plus className="h-4 w-4" />
          Adicionar questão
        </button>
        <button type="submit" disabled={create.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {create.isPending ? <CheckCircle2 className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
          {create.isPending ? 'Publicando...' : 'Publicar para a turma'}
        </button>
        {message && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </form>

      <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h2 className="font-bold dark:text-white">Nova coleção pedagógica</h2>
          <p className="mt-1 text-sm text-slate-500">Organize links e vídeos oficiais para uma turma.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold dark:text-white">Matéria
            <select required value={collectionSubjectId} onChange={(event) => { setCollectionSubjectId(event.target.value); setCollectionClassId(''); }} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Selecione</option>
              {subjects.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold dark:text-white">Turma
            <select required value={collectionClassId} onChange={(event) => setCollectionClassId(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-slate-900">
              <option value="">Selecione</option>
              {collectionClasses.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold dark:text-white">Título
          <input required value={collectionTitle} onChange={(event) => setCollectionTitle(event.target.value)} placeholder="Ex.: Revolução Industrial" className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold dark:text-white">Descrição
          <textarea value={collectionDescription} onChange={(event) => setCollectionDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold dark:text-white">Título do recurso (opcional)
            <input value={collectionResourceTitle} onChange={(event) => setCollectionResourceTitle(event.target.value)} placeholder="Vídeo introdutório" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm font-semibold dark:text-white">Link oficial (opcional)
            <input type="url" value={collectionUrl} onChange={(event) => setCollectionUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
        <button type="button" disabled={createCollection.isPending || !collectionSubjectId || !collectionClassId || !collectionTitle.trim()} onClick={() => createCollection.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-[#005bbf] px-4 py-2 text-sm font-bold text-[#005bbf] disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {createCollection.isPending ? 'Publicando...' : 'Publicar coleção'}
        </button>
        {collections.data?.length ? <div className="border-t pt-4 dark:border-slate-700"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Suas coleções</p><div className="mt-2 flex flex-wrap gap-2">{collections.data.map((collection) => <span key={collection.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800 dark:text-slate-200">{collection.title}</span>)}</div></div> : null}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Resultados recentes</h2>
            <p className="mt-1 text-sm text-slate-500">Use os menores resultados para iniciar um reforço.</p>
          </div>
          <button type="button" onClick={() => setDraft((current) => ({ ...current, activityType: 'REINFORCEMENT', title: current.title || 'Reforço - ', explanation: current.explanation }))} className="inline-flex items-center gap-2 rounded-lg border border-[#005bbf] px-3 py-2 text-sm font-bold text-[#005bbf]"><Plus className="h-4 w-4" />Criar reforço</button>
        </div>
        {attempts.isLoading ? <p className="mt-4 text-sm text-slate-500">Carregando resultados...</p> : attempts.data?.length ? <div className="mt-4 divide-y dark:divide-slate-700">{attempts.data.map((attempt) => { const percentage = attempt.total_points ? Math.round((attempt.score / attempt.total_points) * 100) : 0; return <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold dark:text-white">{studentName(attempt)}</p><p className="text-xs text-slate-500">{activityTitle(attempt)}</p></div><span className={percentage < 60 ? 'font-bold text-amber-600' : 'font-semibold text-emerald-600'}>{percentage}% · {percentage < 60 ? 'Revisar' : 'Acompanhando'}</span></div>; })}</div> : <p className="mt-4 text-sm text-slate-500">Os resultados aparecem quando os alunos concluem uma prática.</p>}
      </section>
    </div>
  );
}

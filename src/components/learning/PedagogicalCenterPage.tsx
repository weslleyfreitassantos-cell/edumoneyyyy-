import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Plus,
  Save,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useResolveTeacherGuidedSessionV2,
  useTeacherAdaptiveInsights,
  useTeacherClassKnowledgeHeatmap,
  useTeacherGuidedInsightsV2,
} from '../../hooks/useAdaptiveLearning';
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
  useTeacherLearningStudents,
  useTeacherLearningClassGaps,
} from '../../hooks/useLearningCenter';
import { learningCenterService } from '../../services/learningCenterService';
import { TeacherKnowledgeHeatmap } from './KnowledgeGraphPanels';

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
  questionBankId: string;
  activityType: 'PRACTICE' | 'REINFORCEMENT' | 'DIAGNOSTIC' | 'LOCK_IN';
}

interface AdditionalQuestionDraft {
  questionBankId: string;
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
  questionBankId: '',
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

function formatMisconceptions(summary: Record<string, number>): string {
  return Object.entries(summary)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([code, total]) => `${code} (${total})`)
    .join(', ');
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
  const [savedDraftId, setSavedDraftId] = useState('');
  const [savedDraftClassId, setSavedDraftClassId] = useState('');
  const [collectionSubjectId, setCollectionSubjectId] = useState('');
  const [collectionClassId, setCollectionClassId] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionUrl, setCollectionUrl] = useState('');
  const [collectionResourceTitle, setCollectionResourceTitle] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankPackage, setBankPackage] = useState('ALL');
  const [bankDifficulty, setBankDifficulty] = useState('ALL');

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
  const guidedInsightsV2 = useTeacherGuidedInsightsV2(currentInstitutionId ?? undefined);
  const resolveGuidedSessionV2 = useResolveTeacherGuidedSessionV2(currentInstitutionId ?? undefined);
  const questionBank = useTeacherQuestionBank(currentInstitutionId ?? undefined);
  const packages = useLearningPackages(currentInstitutionId ?? undefined);
  const teacherClasses = useTeacherLearningClasses(profile?.id);
  const teacherStudents = useTeacherLearningStudents(currentInstitutionId ?? undefined);
  const assignPackage = useAssignLearningPackage(currentInstitutionId ?? undefined);
  const [packageId, setPackageId] = useState('');
  const [packageClassId, setPackageClassId] = useState('');
  const [gapClassId, setGapClassId] = useState('');
  const classGaps = useTeacherLearningClassGaps(currentInstitutionId ?? undefined, gapClassId || undefined);
  const knowledgeHeatmap = useTeacherClassKnowledgeHeatmap(currentInstitutionId ?? undefined, gapClassId || undefined);
  const filteredQuestionBank = useMemo(() => {
    const search = bankSearch.trim().toLocaleLowerCase('pt-BR');
    return (questionBank.data ?? []).filter((item) => {
      const matchesSearch = !search || [item.statement, item.subject_area, item.topic ?? '', item.source_name ?? ''].some((value) => value.toLocaleLowerCase('pt-BR').includes(search));
      const matchesPackage = bankPackage === 'ALL' || item.package_type === bankPackage;
      const matchesDifficulty = bankDifficulty === 'ALL' || item.difficulty === bankDifficulty;
      return matchesSearch && matchesPackage && matchesDifficulty;
    });
  }, [bankDifficulty, bankPackage, bankSearch, questionBank.data]);

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
            question_bank_id: input.questionBankId || undefined,
            question_type: 'MULTIPLE_CHOICE',
            options_json: input.options.split('\n').map((item) => item.trim()).filter(Boolean),
            correct_answer_json: input.correct.trim(),
            explanation: input.explanation.trim() || null,
            points: 1,
            sort_order: 0,
          },
          ...additionalQuestions.map((question, index) => ({
            question_text: question.question.trim(),
            question_bank_id: question.questionBankId || undefined,
            question_type: 'MULTIPLE_CHOICE' as const,
            options_json: question.options.split('\n').map((item) => item.trim()).filter(Boolean),
            correct_answer_json: question.correct.trim(),
            explanation: question.explanation.trim() || null,
            points: 1,
            sort_order: index + 1,
          })),
        ],
      });
      return { ...activity, classId: input.classId };
    },
    onSuccess: (activity) => {
      setSavedDraftId(activity.id);
      setSavedDraftClassId(activity.classId);
      setDraft(emptyDraft);
      setAdditionalQuestions([]);
      setMessage('Rascunho salvo. Revise a atividade antes de publicar para a turma.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar a atividade.');
    },
  });

  const publishDraft = useMutation({
    mutationFn: () => {
      if (!savedDraftId || !savedDraftClassId) throw new Error('O rascunho não possui uma turma válida.');
      return learningCenterService.publishAndAssignActivity({ activity_id: savedDraftId, class_id: savedDraftClassId });
    },
    onSuccess: () => {
      setSavedDraftId('');
      setSavedDraftClassId('');
      setMessage('Atividade publicada e atribuída à turma com sucesso.');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Não foi possível publicar o rascunho.'),
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
    setAdditionalQuestions((questions) => [...questions, { questionBankId: '', question: '', options: '', correct: '', explanation: '' }]);
  };

  const useBankQuestion = (questionId: string) => {
    const item = filteredQuestionBank.find((question) => question.id === questionId);
    if (!item) return;
    setDraft((current) => ({
      ...current,
      questionBankId: item.id,
      question: item.statement,
      options: item.options.join('\n'),
      correct: typeof item.correct_answer === 'string' ? item.correct_answer : JSON.stringify(item.correct_answer),
      explanation: item.explanation ?? '',
    }));
    setMessage('Questão carregada do banco. Revise e publique com o contexto da sua turma.');
  };

  const useBankQuestionForAdditional = (index: number, questionId: string) => {
    const item = filteredQuestionBank.find((question) => question.id === questionId);
    if (!item) return;
    updateAdditionalQuestion(index, 'questionBankId', item.id);
    updateAdditionalQuestion(index, 'question', item.statement);
    updateAdditionalQuestion(index, 'options', item.options.join('\n'));
    updateAdditionalQuestion(index, 'correct', typeof item.correct_answer === 'string' ? item.correct_answer : JSON.stringify(item.correct_answer));
    updateAdditionalQuestion(index, 'explanation', item.explanation ?? '');
    setMessage('Questão adicional carregada do banco.');
  };

  const moveAdditionalQuestion = (index: number, direction: -1 | 1) => {
    setAdditionalQuestions((questions) => {
      const target = index + direction;
      if (target < 0 || target >= questions.length) return questions;
      const reordered = [...questions];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
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

      <nav aria-label="Áreas da Central Pedagógica" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[
          ['pedagogical-overview', 'Visão geral'],
          ['pedagogical-students', 'Alunos'],
          ['pedagogical-diagnostics', 'Diagnóstico'],
          ['pedagogical-content', 'Conteúdo'],
          ['pedagogical-activities', 'Atividades'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#005bbf] hover:text-[#005bbf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {label}
          </a>
        ))}
      </nav>

      <section id="pedagogical-overview" className="scroll-mt-24 grid gap-4 md:grid-cols-3">
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

      <section id="pedagogical-students" aria-label="Alunos em acompanhamento" className="scroll-mt-24 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Alunos em acompanhamento</h2>
            <p className="mt-1 text-sm text-slate-500">Abra o detalhe de um aluno para ver domínio, lacunas e próxima ação.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{teacherStudents.data?.length ?? 0}</span>
        </div>
        {teacherStudents.isLoading ? <p className="mt-4 text-sm text-slate-500">Carregando seus alunos...</p> : teacherStudents.data?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{teacherStudents.data.map((student) => <Link key={`${student.student_id}-${student.class_id}`} to={`/teacher/pedagogical-center/students/${student.student_id}`} className="rounded-lg border p-4 transition hover:border-[#005bbf] dark:border-slate-700"><div className="flex items-start justify-between gap-3"><p className="font-semibold dark:text-white">{student.full_name}</p><span className="text-xs font-bold text-[#005bbf]">{Math.round(student.average_mastery)}%</span></div><p className="mt-1 text-xs text-slate-500">{student.class_name}</p><p className="mt-3 text-xs text-amber-700">{student.open_error_count} ponto(s) para revisar</p></Link>)}</div> : <p className="mt-4 text-sm text-slate-500">Nenhum aluno disponível no seu escopo.</p>}
      </section>

      <section
        id="pedagogical-diagnostics"
        aria-label="Aprendizagem adaptativa"
        className="scroll-mt-24 rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30"
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

      <section aria-label="Jornadas guiadas V2" className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-bold text-amber-950 dark:text-amber-100">Jornadas que precisam de atenção</h2><p className="mt-1 text-sm text-amber-900 dark:text-amber-200">O motivo é estruturado e não expõe respostas ou raciocínio interno.</p></div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">{guidedInsightsV2.data?.length ?? 0}</span>
        </div>
        {guidedInsightsV2.data?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{guidedInsightsV2.data.map((item) => <article key={item.sessionId} className="rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-amber-950/40"><p className="font-semibold text-slate-900 dark:text-white">{item.studentName}</p><p className="mt-1 text-xs text-slate-500">{item.status} · {item.decisionReason ?? 'REVIEW_REQUIRED'} · {item.replanCount} replanejamento(s)</p>{Object.keys(item.misconceptionSummary).length > 0 && <p className="mt-3 text-xs text-amber-900 dark:text-amber-100">Sinais para revisar: {formatMisconceptions(item.misconceptionSummary)}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => resolveGuidedSessionV2.mutate({ sessionId: item.sessionId, action: 'RESUME' })} disabled={resolveGuidedSessionV2.isPending} className="rounded-md border border-amber-400 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-100">Retomar jornada</button><button type="button" onClick={() => resolveGuidedSessionV2.mutate({ sessionId: item.sessionId, action: 'CLOSE' })} disabled={resolveGuidedSessionV2.isPending} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">Encerrar apoio</button></div></article>)}</div> : <p className="mt-4 text-sm text-amber-900 dark:text-amber-200">Nenhuma jornada precisa de intervenção no momento.</p>}
      </section>

      <section aria-label="Lacunas por turma" className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold dark:text-white">Lacunas por turma</h2><p className="mt-1 text-sm text-slate-500">Veja quais habilidades pedem diagnóstico ou reforço coletivo.</p></div>
          <select aria-label="Turma para analisar lacunas" value={gapClassId} onChange={(event) => setGapClassId(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
            <option value="">Selecione uma turma</option>
            {teacherClasses.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        {gapClassId && classGaps.data?.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{classGaps.data.slice(0, 9).map((gap) => <article key={gap.canonical_skill_id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"><p className="font-semibold text-amber-950 dark:text-amber-100">{gap.skill_title}</p><p className="mt-2 text-xs text-amber-900 dark:text-amber-200">{gap.needs_review_count} em revisão · {gap.learning_count} em aprendizagem · {gap.diagnostic_needed_count} sem diagnóstico</p><button type="button" onClick={() => { setDraft((current) => ({ ...current, title: `Reforço: ${gap.skill_title}`, activityType: 'REINFORCEMENT' })); setMessage(`Prepare uma prática para ${gap.skill_title}.`); }} className="mt-3 text-xs font-bold text-amber-900 underline dark:text-amber-100">Criar reforço</button></article>)}</div> : gapClassId ? <p className="mt-4 text-sm text-slate-500">Nenhuma lacuna aberta para esta turma.</p> : <p className="mt-4 text-sm text-slate-500">Escolha uma turma para ver os sinais coletivos.</p>}
      </section>

      <TeacherKnowledgeHeatmap
        rows={knowledgeHeatmap.data}
        isLoading={knowledgeHeatmap.isLoading}
        isError={knowledgeHeatmap.isError}
      />

      <section id="pedagogical-content" aria-label="Banco de questões" className="scroll-mt-24 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold dark:text-white">Banco de questões</h2>
            <p className="mt-1 text-sm text-slate-500">Reutilize questões TecEscola e ENEM sem copiar gabaritos para o aluno.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{questionBank.data?.length ?? 0}</span>
        </div>
        {questionBank.data?.length ? <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input aria-label="Buscar no banco de questões" value={bankSearch} onChange={(event) => setBankSearch(event.target.value)} placeholder="Buscar assunto ou enunciado" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <select aria-label="Filtrar fonte do banco" value={bankPackage} onChange={(event) => setBankPackage(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
              <option value="ALL">Todas as fontes</option><option value="TECESCOLA">TecEscola</option><option value="ENEM">ENEM</option><option value="INSTITUTION">Instituição</option><option value="TEACHER">Professor</option>
            </select>
            <select aria-label="Filtrar dificuldade do banco" value={bankDifficulty} onChange={(event) => setBankDifficulty(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
              <option value="ALL">Todas as dificuldades</option><option value="EASY">Fácil</option><option value="MEDIUM">Média</option><option value="HARD">Difícil</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-slate-500">{filteredQuestionBank.length} questão(ões) encontradas. A origem fica preservada no rascunho.</p>
          {filteredQuestionBank.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{filteredQuestionBank.slice(0, 12).map((item) => <article key={item.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-semibold dark:text-white">{item.statement}</p><button type="button" onClick={() => useBankQuestion(item.id)} className="shrink-0 text-xs font-bold text-[#005bbf]">Adicionar à atividade</button></div><p className="mt-2 text-xs text-slate-500">{item.package_type} · {item.subject_area}{item.topic ? ` · ${item.topic}` : ''}{item.difficulty ? ` · ${item.difficulty}` : ''}</p></article>)}</div> : <p className="mt-3 text-sm text-slate-500">Nenhuma questão corresponde aos filtros.</p>}
        </> : <p className="mt-4 text-sm text-slate-500">O banco aparecerá quando houver questões publicadas para sua instituição.</p>}
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

      <form id="nova-atividade" onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold dark:text-white">Nova atividade</h2>
            <p className="mt-1 text-sm text-slate-500">Uma prática simples para começar o ciclo professor → aluno.</p>
          </div>
          <select value={draft.activityType} onChange={(event) => update('activityType', event.target.value as ActivityDraft['activityType'])} className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
            <option value="PRACTICE">Prática</option>
            <option value="REINFORCEMENT">Reforço</option>
            <option value="DIAGNOSTIC">Diagnóstico</option>
            <option value="LOCK_IN">Fixação</option>
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
            <legend className="flex w-full items-center justify-between gap-2 px-1 text-sm font-bold dark:text-white"><span>Questão {index + 2}</span><span className="flex gap-1"><button type="button" aria-label={`Mover questão ${index + 2} para cima`} title="Mover para cima" disabled={index === 0} onClick={() => moveAdditionalQuestion(index, -1)} className="rounded border p-1 text-slate-500 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" aria-label={`Mover questão ${index + 2} para baixo`} title="Mover para baixo" disabled={index === additionalQuestions.length - 1} onClick={() => moveAdditionalQuestion(index, 1)} className="rounded border p-1 text-slate-500 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button></span></legend>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Reutilizar do banco (opcional)
              <select value={question.questionBankId} onChange={(event) => useBankQuestionForAdditional(index, event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:bg-slate-900 dark:text-white">
                <option value="">Escrever nova questão</option>
                {filteredQuestionBank.slice(0, 20).map((item) => <option key={item.id} value={item.id}>{item.package_type} · {item.statement.slice(0, 90)}</option>)}
              </select>
            </label>
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
        <details className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
          <summary className="cursor-pointer font-semibold dark:text-white">Pré-visualizar questões ({additionalQuestions.length + 1})</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-600 dark:text-slate-300"><li>{draft.question || 'Questão principal ainda não preenchida.'}</li>{additionalQuestions.map((question, index) => <li key={`preview-${index}`}>{question.question || `Questão ${index + 2} ainda não preenchida.`}</li>)}</ol>
        </details>
        <button type="submit" disabled={create.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {create.isPending ? <CheckCircle2 className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
          {create.isPending ? 'Salvando...' : 'Salvar rascunho'}
        </button>
        {savedDraftId ? <button type="button" disabled={publishDraft.isPending} onClick={() => publishDraft.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50">{publishDraft.isPending ? 'Publicando...' : 'Publicar rascunho para a turma'}</button> : null}
        {message && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </form>

      <section id="pedagogical-activities" className="scroll-mt-24 space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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

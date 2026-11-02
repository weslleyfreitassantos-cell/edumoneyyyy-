import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { learningCenterKeys, useLearningSkills, useLearningUnits } from '../../hooks/useLearningCenter';
import type { LearningQuestionBankItem, LearningQuestionBankSearch } from '../../services/learningCenterService';
import { learningCenterService } from '../../services/learningCenterService';
import { humanizeDifficulty, humanizePackageSource, humanizeSubjectArea } from '../../lib/learningPresentation';
import { PageState } from './PedagogicalCenterNav';

type ActivityType = 'PRACTICE' | 'REINFORCEMENT' | 'DIAGNOSTIC' | 'LOCK_IN';
type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
interface QuestionDraft {
  id: string;
  questionBankId: string;
  question: string;
  questionType: QuestionType;
  options: string[];
  correct: string;
  explanation: string;
  points: number;
}

const newQuestion = (): QuestionDraft => ({ id: crypto.randomUUID(), questionBankId: '', question: '', questionType: 'MULTIPLE_CHOICE', options: ['', '', '', ''], correct: '', explanation: '', points: 1 });
const trueFalseOptions = ['Verdadeiro', 'Falso'];

function subjectAreaCode(name: string | undefined) {
  if (!name) return undefined;
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toUpperCase();
  const aliases: Record<string, string> = {
    MATEMATICA: 'MATEMATICA', MATHEMATICS: 'MATEMATICA', MATH: 'MATEMATICA',
    PORTUGUES: 'PORTUGUESE', 'LINGUA PORTUGUESA': 'PORTUGUESE', PORTUGUESE: 'PORTUGUESE',
    INGLES: 'ENGLISH', 'LINGUA INGLESA': 'ENGLISH', ENGLISH: 'ENGLISH',
    BIOLOGIA: 'BIOLOGY', BIOLOGY: 'BIOLOGY', HISTORIA: 'HISTORY', HISTORY: 'HISTORY',
    GEOGRAFIA: 'GEOGRAPHY', GEOGRAPHY: 'GEOGRAPHY', ARTE: 'ART', ART: 'ART',
    FISICA: 'PHYSICS', PHYSICS: 'PHYSICS', QUIMICA: 'CHEMISTRY', CHEMISTRY: 'CHEMISTRY',
  };
  return aliases[normalized] ?? normalized;
}

function answerLabel(answer: unknown) {
  if (typeof answer === 'string') return answer;
  if (answer && typeof answer === 'object') {
    const value = answer as Record<string, unknown>;
    for (const key of ['answer', 'correct_answer', 'value', 'option']) if (typeof value[key] === 'string') return value[key] as string;
  }
  return answer == null ? '' : String(answer);
}

function bankQuestion(item: LearningQuestionBankItem): QuestionDraft {
  const options = Array.isArray(item.options) ? item.options.map(String) : [];
  const normalizedOptions = options.map((option) => option.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'));
  const isTrueFalse = options.length === 2 && normalizedOptions.includes('verdadeiro') && normalizedOptions.includes('falso');
  const rawAnswer = answerLabel(item.correct_answer);
  const normalizedAnswer = rawAnswer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const correct = isTrueFalse
    ? normalizedAnswer === 'true' || normalizedAnswer === 'verdadeiro' ? 'Verdadeiro' : normalizedAnswer === 'false' || normalizedAnswer === 'falso' ? 'Falso' : rawAnswer
    : rawAnswer;
  return { id: crypto.randomUUID(), questionBankId: item.id, question: item.statement, questionType: isTrueFalse ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE', options: isTrueFalse ? trueFalseOptions : options, correct, explanation: item.explanation ?? '', points: 1 };
}

function localDateToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Confira a data escolhida.');
  return date.toISOString();
}

export default function TeacherActivityBuilderPage() {
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [unitId, setUnitId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('PRACTICE');
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion()]);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('ALL');
  const [packageType, setPackageType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selectedBank, setSelectedBank] = useState<Record<string, LearningQuestionBankItem>>({});
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState('');
  const [savedDraftId, setSavedDraftId] = useState('');

  const subjects = useQuery({
    queryKey: ['learning-center', 'classroom-builder-subjects', currentInstitutionId, profile?.id],
    queryFn: () => learningCenterService.teacherSubjects(currentInstitutionId!, profile!.id),
    enabled: Boolean(currentInstitutionId && profile?.id),
  });
  const classes = useQuery({
    queryKey: ['learning-center', 'classroom-builder-classes', currentInstitutionId, profile?.id, subjectId],
    queryFn: () => learningCenterService.teacherClassesForSubject(currentInstitutionId!, profile!.id, subjectId),
    enabled: Boolean(currentInstitutionId && profile?.id && subjectId),
  });
  const authorizedClassIds = useMemo(() => new Set((classes.data ?? []).map((classroom) => classroom.id)), [classes.data]);
  const validClassIds = classIds.filter((id) => authorizedClassIds.has(id));
  const units = useLearningUnits(currentInstitutionId ?? undefined, subjectId);
  const skills = useLearningSkills(currentInstitutionId ?? undefined, unitId);
  const bankFilters = useMemo<LearningQuestionBankSearch>(() => ({
    subjectArea: subjectAreaCode(subjects.data?.find((subject) => subject.id === subjectId)?.name),
    query,
    difficulty,
    packageType,
    page,
    pageSize: 20,
  }), [difficulty, packageType, page, query, subjectId, subjects.data]);
  const bankQuery = useQuery({
    queryKey: ['learning-center', 'teacher-question-bank-search', currentInstitutionId, bankFilters],
    queryFn: () => learningCenterService.searchTeacherQuestionBank(currentInstitutionId!, bankFilters),
    enabled: Boolean(currentInstitutionId && profile?.id && subjectId),
    staleTime: 30_000,
  });

  const createDraft = useMutation({
    mutationFn: () => {
      if (!currentInstitutionId || !profile?.id) throw new Error('Sua sessão ou instituição não está disponível.');
      if (!subjectId) throw new Error('Selecione a matéria.');
      if (!title.trim()) throw new Error('Informe o título da atividade.');
      if (!questions.length || questions.some((question) => !question.question.trim())) throw new Error('Preencha o enunciado de todas as questões.');
      if (questions.some((question) => question.points < 1 || question.points > 100)) throw new Error('Cada questão deve valer de 1 a 100 pontos.');
      if (questions.some((question) => question.questionType === 'MULTIPLE_CHOICE' && (question.options.some((option) => option.trim()).length < 2 || (!question.questionBankId && !question.options.some((option) => option.trim() === question.correct.trim()))))) throw new Error('Cada questão de múltipla escolha precisa de ao menos duas opções e uma resposta correta selecionada.');
      return learningCenterService.createActivityWithQuestions({
        institution_id: currentInstitutionId,
        subject_id: subjectId,
        unit_id: unitId || undefined,
        skill_id: skillId || undefined,
        teacher_id: profile.id,
        title: title.trim(),
        description: description.trim() || undefined,
        activity_type: activityType,
        questions: questions.map((question, index) => ({
          question_text: question.question.trim(),
          question_bank_id: question.questionBankId || undefined,
          question_type: question.questionType,
          options_json: question.questionType === 'TRUE_FALSE' ? trueFalseOptions : question.options.map((option) => option.trim()).filter(Boolean),
          correct_answer_json: question.correct.trim(),
          explanation: question.explanation.trim() || null,
          points: question.points,
          sort_order: index,
        })),
      });
    },
    onSuccess: (activity) => {
      setSavedDraftId(activity.id);
      setMessage('Rascunho salvo. Ele ainda não está visível para os estudantes.');
      setTitle('');
      setDescription('');
      setQuestions([newQuestion()]);
      setSelectedBank({});
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a atividade.'),
  });

  const publish = useMutation({
    mutationFn: (activityId: string) => {
      if (!validClassIds.length) throw new Error('Selecione pelo menos uma turma autorizada para esta matéria.');
      const max = maxAttempts.trim() ? Number(maxAttempts) : null;
      if (max !== null && (!Number.isInteger(max) || max < 1 || max > 50)) throw new Error('O limite deve ser um número inteiro entre 1 e 50.');
      const available = localDateToIso(availableAt);
      const due = localDateToIso(dueAt);
      if (available && due && new Date(due) <= new Date(available)) throw new Error('O encerramento precisa ser posterior à data de abertura.');
      return learningCenterService.publishActivityToClasses({
        activity_id: activityId,
        class_ids: validClassIds,
        available_at: available,
        due_at: due,
        max_attempts: max,
      });
    },
    onSuccess: () => {
      setMessage('Atividade publicada e atribuída às turmas selecionadas.');
      setSavedDraftId('');
      void queryClient.invalidateQueries({ queryKey: learningCenterKeys.all });
    },
    onError: (error) => setMessage(error instanceof Error ? `O rascunho foi preservado. ${error.message}` : 'O rascunho foi preservado, mas não foi possível publicar.'),
  });

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));
  const addSelectedBankQuestions = () => {
    const items = (Object.values(selectedBank) as LearningQuestionBankItem[]).filter((item) => !questions.some((question) => question.questionBankId === item.id));
    if (!items.length) return;
    setQuestions((current) => [...(current.length === 1 && !current[0].question.trim() ? [] : current), ...items.map(bankQuestion)]);
    setSelectedBank({});
    setMessage(`${items.length} questão(ões) adicionada(s) à atividade.`);
  };

  const moveQuestion = (index: number, direction: -1 | 1) => setQuestions((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    try { await createDraft.mutateAsync(); } catch { /* The mutation exposes the validation or server error. */ }
  };

  const toggleClass = (classId: string) => setClassIds((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
  const toggleBankItem = (item: LearningQuestionBankItem) => setSelectedBank((current) => {
    const next = { ...current };
    if (next[item.id]) delete next[item.id]; else next[item.id] = item;
    return next;
  });
  const pages = Math.max(1, Math.ceil((bankQuery.data?.totalCount ?? 0) / 20));
  const busy = createDraft.isPending || publish.isPending;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><Link to="/teacher/classroom" className="inline-flex items-center gap-1 text-sm font-bold text-[#005bbf]"><ArrowLeft size={16} /> Sala de Aula</Link><p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[#005bbf]">Atividades</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Criar atividade</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Monte uma lista de questões, confira a prévia e atribua a atividade a uma ou mais turmas.</p></div>
        <button type="button" onClick={() => setPreview((value) => !value)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-[#005bbf] dark:border-slate-700 dark:bg-slate-900 dark:text-white"><Eye size={17} /> {preview ? 'Voltar ao editor' : 'Prévia do estudante'}</button>
      </header>

      {message ? <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">{message}</p> : null}
      {savedDraftId ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><span>O rascunho está salvo e pode ser retomado em Gerenciar atividades.</span><Link to="/teacher/pedagogical-center/activities" className="font-bold underline">Abrir atividades</Link></div> : null}

      <form onSubmit={save} className="space-y-6">
        <section className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Matéria<select required value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setUnitId(''); setSkillId(''); setClassIds([]); }} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione</option>{subjects.data?.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipo de atividade<select value={activityType} onChange={(event) => setActivityType(event.target.value as ActivityType)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="PRACTICE">Prática</option><option value="REINFORCEMENT">Reforço</option><option value="DIAGNOSTIC">Diagnóstica</option><option value="LOCK_IN">Fixação</option></select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Unidade curricular<select value={unitId} onChange={(event) => { setUnitId(event.target.value); setSkillId(''); }} disabled={!subjectId} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"><option value="">Sem unidade vinculada</option>{units.data?.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Habilidade<select value={skillId} onChange={(event) => setSkillId(event.target.value)} disabled={!unitId} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"><option value="">Sem habilidade vinculada</option>{skills.data?.map((skill) => <option key={skill.id} value={skill.id}>{skill.title}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">Título<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" placeholder="Ex.: Frações equivalentes" /></label>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">Orientação para os estudantes<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" placeholder="Explique o objetivo ou como realizar a atividade." /></label>
        </section>

        <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="question-bank-heading">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="question-bank-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"><Search size={19} className="text-[#005bbf]" /> Banco de questões</h2><p className="mt-1 text-sm text-slate-500">Pesquise e selecione várias questões. Apenas materiais autorizados para uso docente são retornados pelo servidor.</p></div>{Object.keys(selectedBank).length ? <button type="button" onClick={addSelectedBankQuestions} className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-[#005bbf] dark:bg-blue-950/50">Adicionar selecionadas ({Object.keys(selectedBank).length})</button> : null}</div>
          <div className="grid gap-3 sm:grid-cols-3"><label className="relative block sm:col-span-1"><span className="sr-only">Pesquisar questões</span><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Enunciado, tema ou origem" className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm"><span className="sr-only">Dificuldade</span><select aria-label="Filtrar dificuldade" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="ALL">Todas as dificuldades</option><option value="EASY">Fácil</option><option value="MEDIUM">Intermediária</option><option value="HARD">Avançada</option></select></label><label className="text-sm"><span className="sr-only">Origem do material</span><select aria-label="Filtrar origem" value={packageType} onChange={(event) => { setPackageType(event.target.value); setPage(1); }} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="ALL">Todas as origens</option><option value="TECESCOLA">Tec Escola</option><option value="ENEM">ENEM</option><option value="INSTITUTION">Instituição</option><option value="TEACHER">Professor</option></select></label></div>
          {!subjectId ? <PageState>Escolha uma matéria para pesquisar questões compatíveis.</PageState> : bankQuery.isLoading ? <PageState>Buscando questões...</PageState> : bankQuery.isError ? <PageState error>Não foi possível consultar o banco de questões.</PageState> : bankQuery.data?.items.length ? <div className="space-y-2">{bankQuery.data.items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-[#005bbf] dark:border-slate-700"><input type="checkbox" checked={Boolean(selectedBank[item.id])} onChange={() => toggleBankItem(item)} className="mt-1 h-4 w-4 accent-[#005bbf]" /><span className="min-w-0 flex-1"><span className="block line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.statement}</span><span className="mt-1 block text-xs text-slate-500">{humanizeSubjectArea(item.subject_area)}{item.topic ? ` · ${item.topic}` : ''} · {item.source_name || humanizePackageSource(item.package_type)}{item.difficulty ? ` · ${humanizeDifficulty(item.difficulty)}` : ''}</span>{Array.isArray(item.options) && item.options.length ? <span className="mt-2 block text-xs text-slate-600 dark:text-slate-300">{item.options.map((option, index) => <span key={`${item.id}-option-${index}`} className="block">{String.fromCharCode(65 + index)}. {String(option)}</span>)}</span> : null}{item.explanation ? <span className="mt-2 block text-xs text-slate-500">Explicação: {item.explanation}</span> : null}</span></label>)}</div> : <PageState>Nenhuma questão encontrada com esses filtros.</PageState>}
          <div className="flex items-center justify-between border-t pt-3 dark:border-slate-700"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700"><ChevronLeft size={16} /> Anterior</button><span className="text-sm text-slate-500">Página {page} de {pages} · {bankQuery.data?.totalCount ?? 0} questão(ões)</span><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-slate-700">Próxima <ChevronRight size={16} /></button></div>
        </section>

        <section className="space-y-4" aria-labelledby="builder-questions-heading">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="builder-questions-heading" className="text-lg font-bold text-slate-900 dark:text-white">Questões da atividade</h2><p className="mt-1 text-sm text-slate-500">Inclua questões próprias ou combine-as com itens do banco.</p></div><button type="button" onClick={() => setQuestions((current) => [...current, newQuestion()])} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-[#005bbf] dark:border-slate-700 dark:bg-slate-900"><Plus size={16} /> Adicionar questão</button></div>
          {questions.map((question, index) => <article key={question.id} className="space-y-3 rounded-xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900 dark:text-white">Questão {index + 1}{question.questionBankId ? ' · Banco de questões' : ''}</h3><div className="flex items-center gap-1"><button type="button" aria-label={`Mover questão ${index + 1} para cima`} disabled={index === 0} onClick={() => moveQuestion(index, -1)} className="rounded-lg p-2 text-slate-600 disabled:opacity-30 dark:text-slate-300"><ArrowUp size={17} /></button><button type="button" aria-label={`Mover questão ${index + 1} para baixo`} disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} className="rounded-lg p-2 text-slate-600 disabled:opacity-30 dark:text-slate-300"><ArrowDown size={17} /></button><button type="button" aria-label={`Remover questão ${index + 1}`} disabled={questions.length === 1} onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} className="rounded-lg p-2 text-red-700 disabled:opacity-30"><Trash2 size={17} /></button></div></div>
            {preview ? <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><p className="font-semibold text-slate-900 dark:text-white">{question.question || 'Enunciado da questão'}</p><div className="mt-3 space-y-2">{(question.questionType === 'TRUE_FALSE' ? trueFalseOptions : question.options.filter(Boolean)).map((option) => <div key={option} className="rounded-lg border bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">{option}</div>)}</div></div> : <>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Enunciado<textarea required value={question.question} readOnly={Boolean(question.questionBankId)} onChange={(event) => updateQuestion(index, { question: event.target.value })} rows={3} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:read-only:bg-slate-800" placeholder="Escreva uma pergunta clara e objetiva." /></label>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]"><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Formato<select disabled={Boolean(question.questionBankId)} value={question.questionType} onChange={(event) => updateQuestion(index, { questionType: event.target.value as QuestionType, options: event.target.value === 'TRUE_FALSE' ? trueFalseOptions : ['', '', '', ''], correct: '' })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"><option value="MULTIPLE_CHOICE">Múltipla escolha</option><option value="TRUE_FALSE">Verdadeiro ou falso</option></select></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pontos<input type="number" min={1} max={100} value={question.points} onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label></div>
              {question.questionType === 'MULTIPLE_CHOICE' ? <div className="grid gap-3 md:grid-cols-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className="text-sm font-semibold text-slate-700 dark:text-slate-200">Opção {String.fromCharCode(65 + optionIndex)}<input value={option} readOnly={Boolean(question.questionBankId)} onChange={(event) => updateQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-950" /></label>)}</div> : <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">Opções: Verdadeiro · Falso</p>}
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Resposta correta<select disabled={Boolean(question.questionBankId)} required value={question.correct} onChange={(event) => updateQuestion(index, { correct: event.target.value })} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione a resposta correta</option>{(question.questionType === 'TRUE_FALSE' ? trueFalseOptions : question.options.filter(Boolean)).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Explicação após a resposta<textarea value={question.explanation} readOnly={Boolean(question.questionBankId)} onChange={(event) => updateQuestion(index, { explanation: event.target.value })} rows={2} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 read-only:bg-slate-50 dark:border-slate-700 dark:bg-slate-950" placeholder="Explique o raciocínio para apoiar a aprendizagem." /></label>
            </>}</article>)}
        </section>

        <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="assignment-heading">
          <div><h2 id="assignment-heading" className="text-lg font-bold text-slate-900 dark:text-white">Atribuição e disponibilidade</h2><p className="mt-1 text-sm text-slate-500">A publicação exige ao menos uma turma vinculada à matéria e é validada novamente no servidor.</p></div>
          {!subjectId ? <PageState>Selecione uma matéria para carregar suas turmas autorizadas.</PageState> : classes.isLoading ? <PageState>Carregando turmas...</PageState> : classes.isError ? <PageState error>Não foi possível carregar suas turmas autorizadas.</PageState> : classes.data?.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{classes.data.map((classroom) => <label key={classroom.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm font-semibold dark:border-slate-700"><input type="checkbox" checked={classIds.includes(classroom.id)} onChange={() => toggleClass(classroom.id)} className="h-4 w-4 accent-[#005bbf]" />{classroom.name}</label>)}</div> : <PageState>Não há turmas ativas vinculadas a essa matéria.</PageState>}
          <div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Disponível a partir de<input type="datetime-local" value={availableAt} onChange={(event) => setAvailableAt(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Prazo final<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tentativas máximas<input type="number" min={1} max={50} value={maxAttempts} onChange={(event) => setMaxAttempts(event.target.value)} placeholder="Sem limite adicional" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label></div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 dark:border-slate-700"><Link to="/teacher/classroom" className="text-sm font-bold text-slate-600 dark:text-slate-300">Cancelar</Link><div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white">Salvar como rascunho</button><button type="button" disabled={busy || validClassIds.length === 0} onClick={async () => { setMessage(''); try { const activity = await createDraft.mutateAsync(); await publish.mutateAsync(activity.id); } catch { /* Errors are shown by the mutations; a successfully created draft remains available. */ } }} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Check size={17} /> Salvar e publicar</button></div></div>
      </form>
      <aside className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><BookOpen size={17} className="mt-0.5 shrink-0" /><p>Questões do banco mantêm a origem e a resposta correta no servidor. O estudante não recebe gabarito nem explicação antes de responder.</p></aside>
    </main>
  );
}

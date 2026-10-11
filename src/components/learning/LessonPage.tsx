import { CheckCircle2, ChevronLeft, GraduationCap } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useCompleteGuidedLearningStep } from '../../hooks/useLearningCenter';
import { learningCenterService } from '../../services/learningCenterService';
import LessonMarkdown from './LessonMarkdown';

export default function LessonPage() {
  const { lessonId, stepId } = useParams();
  const navigate = useNavigate();
  const lesson = useQuery({
    queryKey: ['learning-center', 'lesson', lessonId],
    queryFn: () => learningCenterService.lesson(lessonId!),
    enabled: Boolean(lessonId),
  });
  const complete = useCompleteGuidedLearningStep();

  if (lesson.isLoading) return <div className="grid min-h-48 place-items-center text-sm text-slate-500">Carregando aula...</div>;
  if (!lesson.data) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Esta aula não está disponível.</div>;

  const finish = async () => {
    if (stepId) await complete.mutateAsync({ stepId });
    navigate('/student/study');
  };

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link to="/student/study" className="inline-flex items-center gap-2 text-sm font-bold text-[#005bbf]"><ChevronLeft className="h-4 w-4" />Voltar ao plano</Link>
      <header className="rounded-xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900/60 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-[#005bbf]" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#005bbf]">Lesson</p>
            <h1 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">{lesson.data.title}</h1>
            <p className="mt-2 text-sm text-blue-900 dark:text-blue-200">{lesson.data.summary}</p>
          </div>
        </div>
      </header>
      <section className="space-y-5 rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-7">
        <LessonMarkdown content={lesson.data.content_markdown} />
        {lesson.data.worked_example && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100"><strong>Exemplo guiado</strong><br />{lesson.data.worked_example}</div>}
        {lesson.data.tips.length > 0 && <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">{lesson.data.tips.map((tip) => <li key={tip} className="flex gap-2"><span className="text-[#005bbf]">•</span>{tip}</li>)}</ul>}
        <button type="button" onClick={() => void finish()} disabled={complete.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4" />
          {complete.isPending ? 'Salvando...' : 'Concluir aula e continuar'}
        </button>
      </section>
    </article>
  );
}

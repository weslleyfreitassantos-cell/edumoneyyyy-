import {
  Accessibility,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  GraduationCap,
  LayoutDashboard,
  Puzzle,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { INCLUSIVE_EDUCATION_DATA_ENABLED, listInclusiveAeePlans, listInclusivePeiPlans, listInclusiveStudents, printInclusiveDocument, saveInclusivePeiPlan, type InclusivePeiInput, type InclusivePeiPlan } from '../../services/inclusiveEducationService';

type InclusiveSection = 'overview' | 'pei' | 'aee-paee' | 'activities' | 'exercises' | 'materials' | 'progress';

const sections: Array<{ id: InclusiveSection; label: string; path: string; description: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Visão Geral', path: '/inclusive-education', description: 'Acompanhe a estrutura de apoio pedagógico inclusivo da instituição.', icon: LayoutDashboard },
  { id: 'pei', label: 'PEI dos Alunos', path: '/inclusive-education/pei', description: 'Planos educacionais individualizados, objetivos e estratégias de aprendizagem.', icon: GraduationCap },
  { id: 'aee-paee', label: 'AEE / PAEE', path: '/inclusive-education/aee-paee', description: 'Organize o atendimento educacional especializado e seus planos de apoio.', icon: Accessibility },
  { id: 'activities', label: 'Biblioteca de Atividades', path: '/inclusive-education/activities', description: 'Reúna atividades adaptadas para diferentes necessidades pedagógicas.', icon: BookOpen },
  { id: 'exercises', label: 'Exercícios Interativos', path: '/inclusive-education/exercises', description: 'Prepare experiências interativas acessíveis para os estudantes.', icon: Puzzle },
  { id: 'materials', label: 'Materiais para Download', path: '/inclusive-education/materials', description: 'Disponibilize materiais pedagógicos adaptados para a comunidade escolar.', icon: Download },
  { id: 'progress', label: 'Evolução Pedagógica', path: '/inclusive-education/progress', description: 'Registre evidências e acompanhe a evolução pedagógica ao longo do tempo.', icon: TrendingUp },
];

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="rounded-2xl bg-gradient-to-br from-[#075fc4] to-[#1686d9] p-6 text-white shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
          <Accessibility className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Educação Inclusiva</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">{description}</p>
        </div>
      </div>
    </header>
  );
}

export default function InclusiveEducationPage() {
  const location = useLocation();
  const { profile } = useAuth();
  const { currentInstitutionId } = useInstitution();
  const current = sections.find((section) => section.path === location.pathname) ?? sections[0];
  const [plans, setPlans] = useState<InclusivePeiPlan[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [aeePlans, setAeePlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<InclusivePeiPlan | null>(null);
  const [form, setForm] = useState<InclusivePeiInput>({ student_id: '', academic_year_id: null, status: 'DRAFT', review_due_on: null, strengths: '', interests: '', learning_barriers: '', pedagogical_objectives: '', teaching_strategies: '', accessibility_resources: '', monitoring_criteria: '' });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentInstitutionId) return;
    if (INCLUSIVE_EDUCATION_DATA_ENABLED && current.id === 'pei') {
      void Promise.all([listInclusivePeiPlans(currentInstitutionId), listInclusiveStudents(currentInstitutionId)]).then(([nextPlans, nextStudents]) => { setPlans(nextPlans); setStudents(nextStudents); }).catch(() => setMessage('Não foi possível carregar os PEIs autorizados.'));
    }
    if (INCLUSIVE_EDUCATION_DATA_ENABLED && current.id === 'aee-paee') void listInclusiveAeePlans(currentInstitutionId).then(setAeePlans).catch(() => setMessage('Não foi possível carregar os planos AEE autorizados.'));
  }, [current.id, currentInstitutionId]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentInstitutionId || !profile || !form.student_id) return;
    try {
      await saveInclusivePeiPlan(currentInstitutionId, profile.id, form, editing?.id);
      setMessage('PEI salvo como rascunho.');
      setEditing(null);
      setPlans(await listInclusivePeiPlans(currentInstitutionId));
    } catch { setMessage('Não foi possível salvar o PEI. Verifique suas permissões.'); }
  }

  function startEdit(plan: InclusivePeiPlan) {
    setEditing(plan);
    setForm({ student_id: plan.student_id, academic_year_id: plan.academic_year_id, status: plan.status, review_due_on: plan.review_due_on, strengths: plan.strengths, interests: plan.interests, learning_barriers: plan.learning_barriers, pedagogical_objectives: plan.pedagogical_objectives, teaching_strategies: plan.teaching_strategies, accessibility_resources: plan.accessibility_resources, monitoring_criteria: plan.monitoring_criteria });
  }

  if (current.id !== 'overview') {
    if (current.id === 'pei') return <div className="space-y-6"><PageHeader title="PEI dos Alunos" description={current.description} /><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Módulo em preparação</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">A estrutura visual está publicada para avaliação. O acesso a dados, criação e edição de PEI ficará disponível após a validação da migration e das políticas de segurança entre instituições.</p></section></div>;
    if (current.id === 'aee-paee') return <div className="space-y-6"><PageHeader title="AEE / PAEE" description={current.description} /><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold text-slate-900 dark:text-white">Módulo em preparação</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">A estrutura visual está publicada para avaliação. O atendimento, os planos e os registros só serão liberados depois da validação das atribuições AEE e das policies RLS.</p></section></div>;
    return (
      <div className="space-y-6">
        <PageHeader title={current.label} description={current.description} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="flex items-start gap-4">
            <ClipboardList className="mt-1 h-6 w-6 shrink-0 text-[#075fc4]" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Estrutura preparada para a próxima etapa</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Esta área já está protegida pelo acesso institucional. Os dados pedagógicos serão conectados após a definição e autorização das tabelas específicas, sem duplicar alunos, turmas ou profissionais.</p>
              <Link to="/inclusive-education" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#075fc4] hover:underline">
                Voltar para a visão geral <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Visão Geral" description="Uma área única para planejar, acompanhar e apoiar a aprendizagem inclusiva com segurança e colaboração entre a equipe escolar." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Áreas de Educação Inclusiva">
        {sections.slice(1).map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.id} to={section.path} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-[#8cc8ee] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#075fc4] focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#075fc4] dark:bg-blue-950/50 dark:text-blue-300"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <h2 className="mt-4 font-bold text-slate-900 dark:text-white">{section.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{section.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#075fc4]">Acessar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
            </Link>
          );
        })}
      </section>
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
        <h2 className="font-bold text-slate-900 dark:text-white">Primeira fase concluída</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">A navegação e os limites de acesso estão prontos. Nenhum indicador é exibido enquanto não houver dados específicos de Educação Inclusiva cadastrados.</p>
      </section>
    </div>
  );
}


import {
  Accessibility,
  ArrowRight,
  BookOpen,
  Download,
  GraduationCap,
  LayoutDashboard,
  Puzzle,
  TrendingUp,
  Youtube,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import { INCLUSIVE_EDUCATION_DATA_ENABLED, listInclusiveAeePlans, listInclusivePeiPlans, listInclusiveStudents, printInclusiveDocument, saveInclusivePeiPlan, type InclusivePeiInput, type InclusivePeiPlan } from '../../services/inclusiveEducationService';
import { inclusiveActivities, externalResources, type InclusiveActivity } from './inclusiveEducationCatalog';
import { InclusiveIllustration, type InclusiveVisualKey } from './InclusiveIllustration';
import { InclusivePrintableMaterial, printableMaterials } from './InclusivePrintableMaterial';
import { InclusiveEducationBrand } from './InclusiveEducationBrand';

type InclusiveSection = 'overview' | 'pei' | 'aee-paee' | 'activities' | 'exercises' | 'materials' | 'progress' | 'videos';

const sections: Array<{ id: InclusiveSection; label: string; path: string; description: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Visão Geral', path: '/inclusive-education', description: 'Acompanhe a estrutura de apoio pedagógico inclusivo da instituição.', icon: LayoutDashboard },
  { id: 'pei', label: 'PEI dos Alunos', path: '/inclusive-education/pei', description: 'Planos educacionais individualizados, objetivos e estratégias de aprendizagem.', icon: GraduationCap },
  { id: 'aee-paee', label: 'AEE / PAEE', path: '/inclusive-education/aee-paee', description: 'Organize o atendimento educacional especializado e seus planos de apoio.', icon: Accessibility },
  { id: 'activities', label: 'Biblioteca de Atividades', path: '/inclusive-education/activities', description: 'Reúna atividades adaptadas para diferentes necessidades pedagógicas.', icon: BookOpen },
  { id: 'exercises', label: 'Exercícios Interativos', path: '/inclusive-education/exercises', description: 'Prepare experiências interativas acessíveis para os estudantes.', icon: Puzzle },
  { id: 'materials', label: 'Materiais para Download', path: '/inclusive-education/materials', description: 'Disponibilize materiais pedagógicos adaptados para a comunidade escolar.', icon: Download },
  { id: 'progress', label: 'Evolução Pedagógica', path: '/inclusive-education/progress', description: 'Registre evidências e acompanhe a evolução pedagógica ao longo do tempo.', icon: TrendingUp },
  { id: 'videos', label: 'Vídeos didáticos', path: '/inclusive-education/videos', description: 'Encontre referências em vídeo para planejar atividades inclusivas.', icon: Youtube },
];

function visualForActivity(id: string): InclusiveVisualKey {
  const map: Record<string, InclusiveVisualKey> = { 'rotina-escola': 'routine', 'lavar-maos': 'hygiene', 'figura-palavra': 'literacy', vogais: 'vowels', silabas: 'syllables', 'leitura-escola': 'reading', 'contar-1-5': 'count', 'contar-1-10': 'count', sequencias: 'sequence', 'cores-formas': 'shapes', compras: 'shopping', 'antes-depois': 'beforeAfter', 'quebra-cabeca': 'school', memoria: 'memory', bingo: 'bingo', 'quadro-escolhas': 'choice', 'ciencias-sentidos': 'senses', 'comunicacao-situacoes': 'communication', 'apoio-professor': 'teacher' };
  return map[id] ?? 'school';
}

function PageHeader({ title, description, icon: Icon = Accessibility }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <header className="rounded-2xl bg-gradient-to-br from-[#075fc4] to-[#1686d9] p-6 text-white shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <InclusiveEducationBrand size="md" />
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
          <Icon className="h-6 w-6" aria-hidden="true" />
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
  const materialId = location.pathname.startsWith('/inclusive-education/materials/') ? location.pathname.split('/').pop() : null;
  const printableMaterial = printableMaterials.find((material) => material.id === materialId);
  const [plans, setPlans] = useState<InclusivePeiPlan[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [aeePlans, setAeePlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<InclusivePeiPlan | null>(null);
  const [form, setForm] = useState<InclusivePeiInput>({ student_id: '', academic_year_id: null, status: 'DRAFT', review_due_on: null, strengths: '', interests: '', learning_barriers: '', pedagogical_objectives: '', teaching_strategies: '', accessibility_resources: '', monitoring_criteria: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCategory, setActivityCategory] = useState('Todas');
  const [selectedActivity, setSelectedActivity] = useState<InclusiveActivity | null>(null);
  const [exerciseMode, setExerciseMode] = useState<string | null>(null);
  const [exerciseAnswer, setExerciseAnswer] = useState<string | null>(null);
  const [exerciseFeedback, setExerciseFeedback] = useState<string | null>(null);
  const [exerciseFinished, setExerciseFinished] = useState(false);

  useEffect(() => {
    if (!currentInstitutionId) return;
    if (INCLUSIVE_EDUCATION_DATA_ENABLED && current.id === 'pei') {
      void Promise.all([listInclusivePeiPlans(currentInstitutionId), listInclusiveStudents(currentInstitutionId)]).then(([nextPlans, nextStudents]) => { setPlans(nextPlans); setStudents(nextStudents); }).catch(() => setMessage('Não foi possível carregar os PEIs autorizados.'));
    }
    if (INCLUSIVE_EDUCATION_DATA_ENABLED && current.id === 'aee-paee') void listInclusiveAeePlans(currentInstitutionId).then(setAeePlans).catch(() => setMessage('Não foi possível carregar os planos AEE autorizados.'));
  }, [current.id, currentInstitutionId]);

  useEffect(() => {
    if (printableMaterial && new URLSearchParams(location.search).get('print') === '1') {
      const timer = window.setTimeout(() => window.print(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [location.search, printableMaterial]);

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

  function renderSectionPage() {
    if (materialId) {
      if (!printableMaterial) return <div className="space-y-6"><PageHeader title="Material não encontrado" description="O material solicitado não está disponível nesta versão local." icon={Download} /><Link to="/inclusive-education/materials" className="inline-flex rounded-lg bg-[#075fc4] px-4 py-2 text-sm font-bold text-white">Voltar aos materiais</Link></div>;
      return <InclusivePrintableMaterial material={printableMaterial} />;
    }
    if (current.id === 'activities') {
      const categories = ['Todas', 'Alfabetização', 'Matemática', 'Comunicação', 'Autonomia', 'Raciocínio e jogos', 'Ciências', 'Recursos para professores'];
      const filtered = inclusiveActivities.filter((activity) => (activityCategory === 'Todas' || activity.category === activityCategory) && `${activity.title} ${activity.description} ${activity.objective}`.toLocaleLowerCase().includes(activitySearch.toLocaleLowerCase()));
      if (selectedActivity) return <div className="space-y-6"><PageHeader title={selectedActivity.title} description={selectedActivity.description} icon={BookOpen} /><article className="inclusive-printable rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8"><div className="print-hidden flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedActivity(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Voltar para a biblioteca</button><button type="button" onClick={() => window.print()} className="rounded-lg bg-[#075fc4] px-3 py-2 text-sm font-semibold text-white">Imprimir / salvar PDF</button></div><div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"><div><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-[#075fc4]">Objetivo</p><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedActivity.objective}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-[#075fc4]">Etapa e duração</p><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedActivity.stages} · {selectedActivity.duration}</p></div></div><section className="mt-6"><h2 className="font-bold text-slate-900 dark:text-white">Instruções para o professor</h2><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedActivity.teacherInstructions}</p></section><section className="mt-5"><h2 className="font-bold text-slate-900 dark:text-white">Instruções para o estudante</h2><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedActivity.studentInstructions}</p></section><section className="mt-5"><h2 className="font-bold text-slate-900 dark:text-white">Conteúdo da atividade</h2><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">{selectedActivity.content.map((item) => <li key={item}>{item}</li>)}</ol></section></div><div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30"><InclusiveIllustration visualKey={visualForActivity(selectedActivity.id)} /><p className="mt-3 text-xs leading-5 text-blue-950 dark:text-blue-100"><strong>Acessibilidade:</strong> {selectedActivity.accessibility}<br /><strong>Respostas:</strong> {selectedActivity.responses}</p></div></div><footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">Produzido pela Tec Escola · versão 1.0 · revisão 15/10/2026</footer></article></div>;
      return <div className="space-y-6"><PageHeader title="Biblioteca de Atividades" description="Atividades autorais ilustradas para abrir, adaptar, imprimir e aplicar com diferentes estudantes." icon={BookOpen} /><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="grid gap-3 md:grid-cols-[1fr_auto]"><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pesquisar atividade<input value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} placeholder="Título, objetivo ou palavra-chave" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label><div className="flex flex-wrap items-end gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => setActivityCategory(category)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${activityCategory === category ? 'border-[#075fc4] bg-[#075fc4] text-white' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{category}</button>)}</div></div></section><section className="grid gap-4 md:grid-cols-2" aria-label="Atividades autorais">{filtered.map((activity) => <article key={activity.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><InclusiveIllustration visualKey={visualForActivity(activity.id)} /><div className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-[#075fc4] dark:bg-blue-950/40 dark:text-blue-200">{activity.category}</span><h2 className="mt-3 font-bold text-slate-900 dark:text-white">{activity.title}</h2></div><span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500">Autoral</span></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{activity.description}</p><p className="mt-2 text-xs text-slate-500">{activity.stages} · {activity.duration} · {activity.responses}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedActivity(activity)} className="rounded-lg bg-[#075fc4] px-3 py-2 text-sm font-bold text-white">Visualizar atividade</button><button type="button" onClick={() => setSelectedActivity(activity)} className="rounded-lg border border-[#075fc4] px-3 py-2 text-sm font-bold text-[#075fc4]">Imprimir / salvar PDF</button></div></div></article>)}{filtered.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-600">Nenhuma atividade corresponde à busca ou categoria selecionada.</div>}</section><section id="recursos-externos" className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40"><h2 className="font-bold text-slate-900 dark:text-white">Recursos externos</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{externalResources.length} fontes para abrir no site original. A Tec Escola não redistribui PDFs de terceiros nem envia dados de estudantes.</p></div><div className="grid gap-4 md:grid-cols-2">{externalResources.map((resource) => <article key={resource.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#075fc4]">{resource.category}</p><h3 className="mt-1 font-bold text-slate-900 dark:text-white">{resource.title}</h3></div><span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500">Externo</span></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{resource.description}</p><p className="mt-2 text-xs text-slate-500">Fonte: {resource.author} · {resource.license}</p><a href={resource.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-[#075fc4] px-3 py-2 text-sm font-bold text-white">Abrir material na fonte</a></article>)}</div></section></div>;
    }
    if (current.id === 'exercises') {
      const modes = [{ id: 'association', label: 'Associação', prompt: 'Qual palavra combina com a imagem da casa?', options: ['casa', 'bola', 'livro'], correct: 'casa' }, { id: 'sequence', label: 'Sequência lógica', prompt: 'Complete: 1, 2, __, 4', options: ['3', '5', '6'], correct: '3' }, { id: 'count', label: 'Contagem', prompt: 'Quantos círculos você vê? ● ● ● ●', options: ['3', '4', '5'], correct: '4' }, { id: 'classification', label: 'Classificação', prompt: 'Qual opção é uma forma geométrica?', options: ['círculo', 'suco', 'escola'], correct: 'círculo' }, { id: 'memory', label: 'Memória', prompt: 'Escolha a palavra que forma par com a mesma palavra.', options: ['casa', 'bola', 'casa'], correct: 'casa' }, { id: 'puzzle', label: 'Quebra-cabeça', prompt: 'Qual ordem completa uma rotina de aula?', options: ['chegar → atividade → guardar', 'guardar → chegar → atividade', 'atividade → sair → chegar'], correct: 'chegar → atividade → guardar' }];
      const mode = modes.find((item) => item.id === exerciseMode);
      function answer(value: string) { if (!mode || exerciseFinished) return; setExerciseAnswer(value); setExerciseFeedback(value === mode.correct ? 'Resposta correta. Você pode continuar ou finalizar.' : 'Ainda não. Tente outra opção; revisar faz parte da aprendizagem.'); }
      function resetExercise() { setExerciseAnswer(null); setExerciseFeedback(null); setExerciseFinished(false); }
      const modeVisual: Record<string, InclusiveVisualKey> = { association: 'literacy', sequence: 'routine', count: 'count', classification: 'shapes', memory: 'memory', puzzle: 'school' };
      return <div className="space-y-6"><PageHeader title="Exercícios Interativos" description="Pratique associação, memória, sequência, contagem, classificação e organização visual sem dados pessoais externos." icon={Puzzle} /><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modes.map((item) => <button key={item.id} type="button" onClick={() => { setExerciseMode(item.id); resetExercise(); }} className={`rounded-xl border p-4 text-left transition hover:border-[#075fc4] ${exerciseMode === item.id ? 'border-[#075fc4] bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}><span className="text-sm font-bold text-slate-900 dark:text-white">{item.label}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">Iniciar exercício</span></button>)}</section>{mode ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-live="polite"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><div><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#075fc4]">{mode.label}</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{mode.prompt}</h2></div><button type="button" onClick={resetExercise} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Reiniciar</button></div><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Escolha uma resposta. Não há cronômetro nem ranking.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{mode.options.map((option) => <button key={option} type="button" onClick={() => answer(option)} aria-pressed={exerciseAnswer === option} className={`min-h-12 rounded-xl border px-4 py-3 text-left font-semibold ${exerciseAnswer === option ? 'border-[#075fc4] bg-blue-50 text-[#075fc4]' : 'border-slate-300 text-slate-800 dark:border-slate-700 dark:text-slate-100'}`}>{option}</button>)}</div>{exerciseFeedback && <p className={`mt-4 rounded-xl p-4 text-sm font-semibold ${exerciseAnswer === mode.correct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{exerciseFeedback}</p>}<div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => setExerciseFinished(true)} className="rounded-lg bg-[#075fc4] px-3 py-2 text-sm font-bold text-white">Finalizar exercício</button><button type="button" onClick={() => { setExerciseMode(null); resetExercise(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Voltar aos mecanismos</button></div>{exerciseFinished && <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Exercício finalizado nesta sessão local. Nenhum resultado pessoal foi salvo.</p>}</div><InclusiveIllustration visualKey={modeVisual[mode.id]} /></div></section> : <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Escolha um mecanismo acima para iniciar.</section>}</div>;
    }
    if (current.id === 'videos') {
      const videos = [
        ['Educação inclusiva e práticas pedagógicas', 'Instituto Rodrigo Mendes', 'https://www.youtube.com/results?search_query=Instituto+Rodrigo+Mendes+educacao+inclusiva'],
        ['Comunicação alternativa na escola', 'Comunicação Alternativa', 'https://www.youtube.com/results?search_query=comunicacao+alternativa+escola+educacao+inclusiva'],
        ['Rotina visual e antecipação', 'Educação inclusiva', 'https://www.youtube.com/results?search_query=rotina+visual+educacao+inclusiva'],
        ['Atividades adaptadas para alfabetização', 'Nova Escola', 'https://www.youtube.com/results?search_query=Nova+Escola+alfabetizacao+inclusiva+atividades+adaptadas'],
        ['Matemática acessível e funcional', 'Nova Escola', 'https://www.youtube.com/results?search_query=matematica+adaptada+educacao+inclusiva'],
        ['AEE e planejamento pedagógico', 'MEC Educação', 'https://www.youtube.com/results?search_query=MEC+AEE+atendimento+educacional+especializado'],
        ['Desenho Universal para Aprendizagem', 'CAST UDL', 'https://www.youtube.com/results?search_query=CAST+Universal+Design+for+Learning'],
        ['Estratégias de apoio para estudantes autistas', 'Autismo e educação', 'https://www.youtube.com/results?search_query=estrategias+educacionais+autismo+sala+de+aula'],
        ['Jogos pedagógicos inclusivos', 'Práticas inclusivas', 'https://www.youtube.com/results?search_query=jogos+pedagogicos+inclusivos+educacao'],
        ['Acessibilidade cognitiva e linguagem simples', 'W3C WAI', 'https://www.youtube.com/results?search_query=acessibilidade+cognitiva+linguagem+simples+educacao'],
      ];
      return <div className="space-y-6"><PageHeader title="Vídeos para atividades didáticas" description="Referências externas para professores pesquisarem estratégias, atividades e recursos inclusivos." icon={Youtube} /><section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">Os links abrem pesquisas públicas no YouTube. A Tec Escola não hospeda os vídeos, não controla anúncios e não envia dados de estudantes. Confira o conteúdo e a adequação à turma antes de aplicar.</section><section className="grid gap-4 md:grid-cols-2">{videos.map(([title, author, url]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30"><Youtube className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-bold text-slate-900 dark:text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">Referência externa · {author}</p></div></div><a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-[#075fc4] px-3 py-2 text-sm font-bold text-white">Pesquisar no YouTube</a></article>)}</section></div>;
    }
    if (current.id === 'materials') {
      return <div className="space-y-6"><PageHeader title="Materiais para Download" description="Folhas autorais da Tec Escola para consultar, imprimir e salvar como PDF." icon={Download} /><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start gap-3"><Download className="mt-0.5 h-5 w-5 text-[#075fc4]" aria-hidden="true" /><div><h2 className="font-bold text-slate-900 dark:text-white">Materiais disponíveis agora</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Abra a visualização própria de cada folha e use o botão de impressão para salvar em PDF.</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-2">{printableMaterials.map((material) => <article key={material.id} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950/40"><p className="text-xs font-bold uppercase tracking-wide text-[#075fc4]">{material.category}</p><h3 className="mt-1 font-bold text-slate-900 dark:text-white">{material.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{material.objective}</p><div className="mt-4 flex flex-wrap gap-2"><Link to={`/inclusive-education/materials/${material.id}`} className="rounded-lg border border-[#075fc4] px-3 py-2 text-xs font-bold text-[#075fc4]">Abrir folha A4</Link><Link to={`/inclusive-education/materials/${material.id}?print=1`} className="rounded-lg bg-[#075fc4] px-3 py-2 text-xs font-bold text-white">Imprimir / salvar PDF</Link></div></article>)}</div></section><section className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Os materiais são autorais. O PDF é salvo pelo diálogo de impressão do navegador; nenhum documento sensível é gerado nesta tela.</section></div>;
    }
    const Icon = current.icon;
    const pageContent: Record<Exclude<InclusiveSection, 'overview' | 'pei' | 'aee-paee'>, { heading: string; body: string; items: string[] }> = {
      activities: {
        heading: 'Biblioteca organizada por necessidade pedagógica',
        body: 'Prepare uma coleção de atividades adaptadas, com acessibilidade, faixa etária e objetivo pedagógico definidos.',
        items: ['Atividades por objetivo de aprendizagem', 'Filtros por recurso de acessibilidade', 'Histórico de versões e materiais privados'],
      },
      exercises: {
        heading: 'Exercícios acessíveis e interativos',
        body: 'Planeje exercícios com diferentes formas de resposta e recursos de apoio para cada perfil de aprendizagem.',
        items: ['Respostas por texto, áudio ou seleção', 'Instruções com linguagem simples', 'Acompanhamento por tentativa e habilidade'],
      },
      materials: {
        heading: 'Materiais para download',
        body: 'Centralize materiais autorizados para professores, profissionais de AEE e famílias, respeitando a instituição de origem.',
        items: ['Arquivos organizados por público', 'Controle de acesso institucional', 'Download seguro e registro de atualização'],
      },
      progress: {
        heading: 'Acompanhamento da evolução pedagógica',
        body: 'Registre evidências, revisões e próximos passos sem expor dados sensíveis fora dos vínculos autorizados.',
        items: ['Linha do tempo de objetivos', 'Evidências pedagógicas por período', 'Revisões colaborativas com histórico'],
      },
      videos: {
        heading: 'Referências em vídeo para professores',
        body: 'Pesquisas externas no YouTube sobre práticas e atividades inclusivas.',
        items: ['Fontes externas identificadas', 'Aviso de abertura fora da Tec Escola', 'Nenhum dado de estudante enviado'],
      },
    };
    const content = pageContent[current.id as Exclude<InclusiveSection, 'overview' | 'pei' | 'aee-paee'>];
    const catalog = [
      ['Escolha e associe', 'Atenção e comunicação', 'Associe imagens, palavras ou símbolos com apoio visual.'],
      ['Complete a sequência', 'Funções executivas', 'Organize etapas de uma rotina e explique a ordem escolhida.'],
      ['Resposta multimodal', 'Expressão', 'Permita responder digitando, falando, apontando ou desenhando.'],
      ['Tempo e pausa', 'Autorregulação', 'Inclua instruções curtas, temporizador e pausa planejada.'],
    ];
    return (
      <div className="space-y-6">
        <PageHeader title={current.label} description={current.description} icon={Icon} />
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#075fc4] dark:bg-blue-950/50 dark:text-blue-300"><Icon className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{content.heading}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{content.body}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Filtros de conteúdo">
            {['Todos', 'Educação Infantil', 'Anos iniciais', 'Comunicação', 'Autonomia'].map((filter, index) => <button key={filter} type="button" disabled={index > 0} className={`rounded-full border px-3 py-2 text-xs font-semibold ${index === 0 ? 'border-[#075fc4] bg-[#075fc4] text-white' : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900'}`}>{filter}</button>)}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {catalog.map(([title, category, description]) => <article key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#075fc4]">{category}</p><h3 className="mt-1 font-bold text-slate-900 dark:text-white">{title}</h3></div><Icon className="h-5 w-5 shrink-0 text-[#075fc4]" aria-hidden="true" /></div><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p></article>)}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {content.items.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200">{item}</div>)}
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Esta área está disponível para avaliação visual. A criação e o armazenamento de dados serão liberados após a validação das permissões e das policies de isolamento entre instituições.
          </div>
        </section>
      </div>
    );
  }

  if (materialId) return renderSectionPage();

  if (current.id !== 'overview') {
    if (current.id === 'pei' || current.id === 'aee-paee') {
      const Icon = current.icon;
      const isPei = current.id === 'pei';
      const fields = isPei
        ? ['Estudante autorizado', 'Pontos fortes e interesses', 'Barreiras observadas', 'Objetivos pedagógicos', 'Estratégias e adaptações', 'Recursos de acessibilidade', 'Critérios de acompanhamento']
        : ['Estudante com atendimento autorizado', 'Profissional atribuído', 'Objetivo do atendimento', 'Estratégia utilizada', 'Material aplicado', 'Data e participação observada', 'Próximas ações'];
      return <div className="space-y-6"><PageHeader title={current.label} description={current.description} icon={Icon} /><section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><strong>Modo seguro de preparação.</strong> Esta interface está pronta para receber os registros autorizados, mas a consulta e o salvamento permanecem desativados até a validação efetiva do RLS, dos vínculos institucionais e das permissões no backend.</section><section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{isPei ? 'Planejamento individualizado' : 'Planejamento e registro do atendimento'}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Os campos abaixo representam o fluxo previsto e ainda não gravam dados.</p></div><span className="rounded-full border border-amber-300 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-700 dark:text-amber-200">Somente visualização</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2">{fields.map((field, index) => <label key={field} className={index > 0 && index !== 1 ? 'sm:col-span-2 text-sm font-semibold text-slate-700 dark:text-slate-200' : 'text-sm font-semibold text-slate-700 dark:text-slate-200'}>{field}{index === 0 ? <select disabled className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800"><option>Seleção protegida por autorização</option></select> : <textarea disabled rows={index === 1 ? 2 : 3} placeholder="Disponível após validação das permissões" className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800" />}</label>)}</div><div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-bold text-slate-600">Salvar rascunho</button><button type="button" disabled className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-500">Imprimir documento</button></div></div><aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950/40"><h2 className="font-bold text-slate-900 dark:text-white">Fluxo previsto</h2><ol className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{(isPei ? ['Selecionar estudante com vínculo autorizado', 'Definir objetivos e estratégias', 'Relacionar atividades da biblioteca', 'Revisar e imprimir com autorização'] : ['Confirmar atribuição do profissional AEE', 'Planejar objetivo e estratégia', 'Registrar sessão e participação', 'Revisar histórico e relatório']).map((item, index) => <li key={item} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-[#075fc4] dark:bg-blue-900/50 dark:text-blue-200">{index + 1}</span><span>{item}</span></li>)}</ol><p className="mt-6 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">Nenhum nome, diagnóstico, laudo ou documento sensível é carregado nesta fase local.</p></aside></section><Link to="/inclusive-education" className="inline-flex items-center gap-2 text-sm font-bold text-[#075fc4] hover:underline"><ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />Voltar para a visão geral</Link></div>;
    }
    if (current.id === 'progress') {
      return <div className="space-y-6"><PageHeader title={current.label} description={current.description} icon={current.icon} /><section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"><TrendingUp className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" /><h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Nenhum registro de evolução disponível</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">A evolução pedagógica será exibida quando houver objetivos, atividades atribuídas e observações autorizadas. Não há gráficos ou resultados fictícios nesta versão local.</p><p className="mt-4 text-sm font-semibold text-[#075fc4]">A estrutura de acompanhamento será conectada aos registros reais de PEI e AEE após a validação da persistência.</p></section></div>;
    }
    return renderSectionPage();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Visão Geral" description="Uma área única para planejar, acompanhar e apoiar a aprendizagem inclusiva com segurança e colaboração entre a equipe escolar." />
      <section className="flex items-center gap-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <InclusiveEducationBrand size="lg" />
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#075fc4]">Identidade do módulo</p><h2 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">Educação Inclusiva Tec Escola</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Planejamento, acessibilidade e participação para diferentes formas de aprender.</p></div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Indicadores do catálogo local">
        {[['Atividades autorais', inclusiveActivities.length], ['Recursos externos', externalResources.length], ['Mecanismos interativos', 6]].map(([label, value]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-extrabold text-[#075fc4]">{value}</p></article>)}
      </section>
      <section className="flex flex-wrap gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <Link to="/inclusive-education/activities" className="rounded-lg bg-[#075fc4] px-4 py-2 text-sm font-bold text-white">Pesquisar atividades</Link>
        <Link to="/inclusive-education/pei" className="rounded-lg border border-[#075fc4] px-4 py-2 text-sm font-bold text-[#075fc4]">Consultar PEI</Link>
        <Link to="/inclusive-education/aee-paee" className="rounded-lg border border-[#075fc4] px-4 py-2 text-sm font-bold text-[#075fc4]">Consultar AEE / PAEE</Link>
      </section>
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
        <h2 className="font-bold text-slate-900 dark:text-white">Dados de estudantes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Nenhum PEI cadastrado. Os documentos sensíveis permanecem protegidos e não são preenchidos com dados fictícios.</p>
      </section>
    </div>
  );
}


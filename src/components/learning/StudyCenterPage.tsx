import { BookOpen, CheckCircle2, GraduationCap, PlayCircle, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';

const subjects = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Biologia'];
const skills = [
  ['Frações', 'Dominado', 'bg-emerald-500', '80%'],
  ['Equações', 'Em progresso', 'bg-amber-500', '55%'],
  ['Geometria', 'Não iniciado', 'bg-slate-300', '0%'],
];

export default function StudyCenterPage() {
  const [search, setSearch] = useState('');
  const visibleSubjects = subjects.filter((item) => item.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <div className="space-y-6">
    <header><div className="flex items-center gap-3"><GraduationCap className="h-7 w-7 text-[#005bbf]"/><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Aluno</p><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Central de Estudos</h1></div></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Olá! O que vamos estudar hoje?</p></header>
    <label className="flex max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"><Search className="h-5 w-5 text-slate-400"/><input aria-label="Pesquisar matéria ou assunto" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar matéria ou assunto" className="w-full bg-transparent text-sm outline-none dark:text-white"/></label>
    <section><h2 className="mb-3 font-bold text-slate-900 dark:text-white">Minhas matérias</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleSubjects.map((subject) => <button type="button" key={subject} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-[#005bbf] dark:border-slate-700 dark:bg-slate-900"><BookOpen className="h-5 w-5 text-[#005bbf]"/><span className="font-semibold dark:text-white">{subject}</span></button>)}</div></section>
    <section className="grid gap-4 lg:grid-cols-2"><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500"/><h2 className="font-bold dark:text-white">Praticar agora</h2></div><p className="mt-2 text-sm text-slate-500">Escolha uma habilidade para iniciar uma prática rápida.</p><button type="button" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-4 py-2 text-sm font-bold text-white"><PlayCircle className="h-4 w-4"/>Começar prática</button></article><article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="font-bold dark:text-white">Meu progresso</h2><div className="mt-4 space-y-4">{skills.map(([name, status, color, value]) => <div key={name}><div className="flex justify-between text-sm"><span className="font-semibold dark:text-white">{name}</span><span className="text-slate-500">{status}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700"><div className={`h-2 rounded-full ${color}`} style={{ width: value }}/></div></div>)}</div></article></section>
    <section className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-900/50 dark:bg-blue-950/30"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#005bbf]"/><h2 className="font-bold text-blue-900 dark:text-blue-200">Recomendado pelo professor</h2></div><p className="mt-2 text-sm text-blue-800 dark:text-blue-300">As atividades atribuídas pelos seus professores aparecerão aqui.</p></section>
  </div>;
}

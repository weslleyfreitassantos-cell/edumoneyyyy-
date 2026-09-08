import { BookOpen, Download, ExternalLink, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

type Subject = 'Todas' | 'Ciências' | 'História' | 'Matemática' | 'Português';
const subjects: Subject[] = ['Todas', 'Ciências', 'História', 'Matemática', 'Português'];
const resources = [
  { subject: 'Ciências', title: 'Ciência para crianças e jovens', description: 'Livros e materiais gratuitos para descobrir o mundo da ciência.', url: 'https://openstax.org/subjects/science' },
  { subject: 'História', title: 'História do Brasil', description: 'Acervo digital com livros e documentos históricos de acesso público.', url: 'https://www.dominiopublico.gov.br/pesquisa/PesquisaObraForm.jsp' },
  { subject: 'Matemática', title: 'Matemática aberta', description: 'Livros didáticos gratuitos para estudar matemática em diferentes níveis.', url: 'https://openstax.org/subjects/math' },
  { subject: 'Português', title: 'Literatura e língua portuguesa', description: 'Obras literárias completas disponíveis gratuitamente para leitura.', url: 'https://www.dominiopublico.gov.br/pesquisa/PesquisaObraForm.jsp' },
];

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<Subject>('Todas');
  const visibleResources = useMemo(() => resources.filter((resource) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (subject === 'Todas' || resource.subject === subject) && (!term || `${resource.subject} ${resource.title} ${resource.description}`.toLocaleLowerCase('pt-BR').includes(term));
  }), [search, subject]);
  return <div className="space-y-6">
    <header><div className="flex items-center gap-3"><BookOpen className="h-7 w-7 text-[#005bbf]" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Acadêmico</p><h1 className="text-2xl font-bold text-[#181c20] dark:text-white">Biblioteca digital</h1></div></div><p className="mt-2 text-sm text-[#727785] dark:text-slate-400">Encontre apostilas, livros e PDFs gratuitos disponíveis na internet.</p></header>
    <section className="flex flex-col gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row"><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#dfe3e8] px-3 py-2 dark:border-slate-700"><Search className="h-5 w-5 text-slate-400" aria-hidden="true" /><input aria-label="Buscar livros e apostilas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite ciência, história, matemática..." className="w-full bg-transparent text-sm outline-none dark:text-white" /></label><select aria-label="Selecionar matéria" value={subject} onChange={(event) => setSubject(event.target.value as Subject)} className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">{subjects.map((item) => <option key={item}>{item}</option>)}</select></section>
    <div className="flex items-center justify-between"><h2 className="font-bold text-[#181c20] dark:text-white">Materiais gratuitos</h2><span className="text-xs text-slate-500">{visibleResources.length} encontrados</span></div>
    <section className="grid gap-4 md:grid-cols-2">{visibleResources.map((resource) => <article key={resource.title} className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start gap-3"><div className="rounded-lg bg-blue-50 p-2 text-[#005bbf] dark:bg-blue-950/40"><FileText className="h-5 w-5" aria-hidden="true" /></div><div><span className="text-xs font-bold uppercase tracking-wide text-[#005bbf]">{resource.subject}</span><h3 className="mt-1 font-bold text-[#181c20] dark:text-white">{resource.title}</h3></div></div><p className="mt-4 text-sm leading-6 text-[#727785] dark:text-slate-400">{resource.description}</p><div className="mt-5 flex flex-wrap gap-2"><a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white hover:bg-[#004a9c]"><ExternalLink className="h-4 w-4" aria-hidden="true" />Visualizar online</a><a href={resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#cfd7e6] px-3 py-2 text-xs font-bold text-[#005bbf] hover:bg-blue-50"><Download className="h-4 w-4" aria-hidden="true" />Abrir / baixar PDF</a></div></article>)}</section>
    {visibleResources.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum material encontrado para essa busca.</p>}
    <p className="text-xs text-slate-500 dark:text-slate-400">Os materiais são hospedados por portais públicos externos. O TEC Escola não armazena nem edita esses arquivos.</p>
  </div>;
}

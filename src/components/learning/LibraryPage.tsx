import { BookOpen, ExternalLink, Search, ShoppingCart, Star } from 'lucide-react';
import { useMemo, useState } from 'react';

type Subject = 'Todos' | 'História' | 'Ciências' | 'Matemática' | 'Português' | 'Literatura';
const subjects: Subject[] = ['Todos', 'História', 'Ciências', 'Matemática', 'Português', 'Literatura'];
const recommendations = [
  { subject: 'História', title: 'Uma breve história do tempo', author: 'Stephen Hawking', note: 'Uma leitura acessível para conhecer ideias que mudaram a ciência.', query: 'Uma breve história do tempo Stephen Hawking' },
  { subject: 'História', title: 'O povo brasileiro', author: 'Darcy Ribeiro', note: 'Uma introdução marcante à formação histórica e cultural do Brasil.', query: 'O povo brasileiro Darcy Ribeiro' },
  { subject: 'Ciências', title: 'O mundo assombrado pelos demônios', author: 'Carl Sagan', note: 'Pensamento crítico e curiosidade científica em uma leitura envolvente.', query: 'O mundo assombrado pelos demônios Carl Sagan' },
  { subject: 'Matemática', title: 'O homem que calculava', author: 'Malba Tahan', note: 'Matemática apresentada por meio de histórias e desafios.', query: 'O homem que calculava Malba Tahan' },
  { subject: 'Português', title: 'Gramática em textos', author: 'Ulisses Infante', note: 'Apoio prático para estudar língua portuguesa e produção textual.', query: 'Gramática em textos Ulisses Infante' },
  { subject: 'Literatura', title: 'Dom Casmurro', author: 'Machado de Assis', note: 'Um clássico brasileiro para ler, interpretar e discutir.', query: 'Dom Casmurro Machado de Assis livro' },
];

function storeUrl(store: 'amazon' | 'mercadoLivre', query: string) {
  const encoded = encodeURIComponent(query);
  return store === 'amazon' ? `https://www.amazon.com.br/s?k=${encoded}` : `https://lista.mercadolivre.com.br/${encoded.replace(/%20/g, '-')}`;
}

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<Subject>('Todos');
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return recommendations.filter((book) => (subject === 'Todos' || book.subject === subject) && (!term || `${book.title} ${book.author} ${book.subject}`.toLocaleLowerCase('pt-BR').includes(term)));
  }, [search, subject]);
  const customQuery = search.trim();

  return <div className="space-y-6">
    <header><div className="flex items-center gap-3"><BookOpen className="h-7 w-7 text-[#005bbf]" aria-hidden="true" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Acadêmico</p><h1 className="text-2xl font-bold text-[#181c20] dark:text-white">Indicações de livros</h1></div></div><p className="mt-2 text-sm text-[#727785] dark:text-slate-400">Descubra livros para estudar e encontre opções de compra nas principais lojas.</p></header>
    <section className="flex flex-col gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row"><label className="flex flex-1 items-center gap-2 rounded-lg border border-[#dfe3e8] px-3 py-2 dark:border-slate-700"><Search className="h-5 w-5 text-slate-400" aria-hidden="true" /><input aria-label="Buscar livro ou tema" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite um livro, autor ou tema" className="w-full bg-transparent text-sm outline-none dark:text-white" /></label><select aria-label="Selecionar categoria" value={subject} onChange={(event) => setSubject(event.target.value as Subject)} className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">{subjects.map((item) => <option key={item}>{item}</option>)}</select></section>
    {customQuery && <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30"><p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Pesquisar “{customQuery}” nas lojas</p><div className="mt-3 flex flex-wrap gap-2"><a target="_blank" rel="noreferrer" href={storeUrl('amazon', customQuery)} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white"><ShoppingCart className="h-4 w-4" />Amazon</a><a target="_blank" rel="noreferrer" href={storeUrl('mercadoLivre', customQuery)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#005bbf]"><ShoppingCart className="h-4 w-4" />Mercado Livre</a></div></section>}
    <div className="flex items-center justify-between"><h2 className="font-bold text-[#181c20] dark:text-white">Recomendações por assunto</h2><span className="text-xs text-slate-500">{visible.length} livros</span></div>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((book) => <article key={book.title} className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div className="rounded-lg bg-blue-50 p-2 text-[#005bbf] dark:bg-blue-950/40"><BookOpen className="h-5 w-5" aria-hidden="true" /></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{book.subject}</span></div><h3 className="mt-4 font-bold text-[#181c20] dark:text-white">{book.title}</h3><p className="mt-1 text-sm font-semibold text-[#005bbf]">{book.author}</p><p className="mt-3 min-h-12 text-sm leading-6 text-[#727785] dark:text-slate-400">{book.note}</p><div className="mt-4 flex items-center gap-1 text-amber-500" aria-label="Recomendado"><Star className="h-4 w-4 fill-current" /><span className="text-xs font-semibold text-slate-500">Recomendado para estudo</span></div><div className="mt-5 flex flex-wrap gap-2"><a target="_blank" rel="noreferrer" href={storeUrl('amazon', book.query)} className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white"><ExternalLink className="h-4 w-4" />Ver na Amazon</a><a target="_blank" rel="noreferrer" href={storeUrl('mercadoLivre', book.query)} className="inline-flex items-center gap-2 rounded-lg border border-[#cfd7e6] px-3 py-2 text-xs font-bold text-[#005bbf]"><ExternalLink className="h-4 w-4" />Ver no Mercado Livre</a></div></article>)}</section>
    {visible.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhuma indicação encontrada. Use a busca acima para procurar diretamente nas lojas.</p>}
    <p className="text-xs text-slate-500 dark:text-slate-400">O TEC Escola apenas recomenda títulos e direciona para lojas oficiais. Preços, estoque, entrega e condições são definidos pelas lojas e podem mudar. Alguns links podem gerar comissão sem custo adicional para você.</p>
  </div>;
}

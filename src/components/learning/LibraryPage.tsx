import { BookOpen, Search } from 'lucide-react';
import { useState } from 'react';

const sections = [
  { title: 'Livros e apostilas', description: 'Materiais de estudo disponibilizados pela escola.' },
  { title: 'Leituras recomendadas', description: 'Conteúdos selecionados para apoiar sua aprendizagem.' },
  { title: 'Documentos da escola', description: 'Regulamentos, orientações e documentos importantes.' },
];

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const visibleSections = sections.filter((section) =>
    `${section.title} ${section.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <BookOpen className="h-7 w-7 text-[#005bbf]" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Acadêmico</p>
            <h1 className="text-2xl font-bold text-[#181c20] dark:text-white">Biblioteca</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#727785] dark:text-slate-400">Acesse os materiais de leitura e documentos da sua escola.</p>
      </header>

      <label className="flex max-w-xl items-center gap-2 rounded-xl border border-[#dfe3e8] bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
        <input aria-label="Buscar na biblioteca" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na biblioteca" className="w-full bg-transparent text-sm outline-none dark:text-white" />
      </label>

      <section className="grid gap-4 md:grid-cols-3">
        {visibleSections.map((section) => (
          <article key={section.title} className="rounded-xl border border-[#dfe3e8] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <BookOpen className="h-6 w-6 text-[#005bbf]" aria-hidden="true" />
            <h2 className="mt-4 font-bold text-[#181c20] dark:text-white">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#727785] dark:text-slate-400">{section.description}</p>
            <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400">Nenhum item publicado ainda.</p>
          </article>
        ))}
      </section>

      {visibleSections.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum resultado encontrado.</p>}
    </div>
  );
}

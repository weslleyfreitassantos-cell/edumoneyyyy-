import {
  BookOpen,
  ExternalLink,
  Search,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';

type Subject =
  | 'Todos'
  | 'História'
  | 'Ciências'
  | 'Matemática'
  | 'Português'
  | 'Literatura';

interface BookRecommendation {
  subject: Exclude<Subject, 'Todos'>;
  title: string;
  author: string;
  isbn: string;
  coverUrl: string | null;
  note: string;
  query: string;
}

const subjects: Subject[] = [
  'Todos',
  'História',
  'Ciências',
  'Matemática',
  'Português',
  'Literatura',
];

const recommendations: BookRecommendation[] = [
  {
    subject: 'Ciências',
    title: 'Uma breve história do tempo',
    author: 'Stephen Hawking',
    isbn: '9788535905409',
    coverUrl: null,
    note: 'Uma leitura acessível para conhecer ideias que mudaram a ciência.',
    query: 'Uma breve história do tempo Stephen Hawking',
  },
  {
    subject: 'História',
    title: 'O povo brasileiro',
    author: 'Darcy Ribeiro',
    isbn: '9788526022574',
    coverUrl: 'https://covers.openlibrary.org/b/id/3842030-L.jpg',
    note: 'Uma introdução marcante à formação histórica e cultural do Brasil.',
    query: 'O povo brasileiro Darcy Ribeiro',
  },
  {
    subject: 'Ciências',
    title: 'O mundo assombrado pelos demônios',
    author: 'Carl Sagan',
    isbn: '9788535908349',
    coverUrl: null,
    note: 'Pensamento crítico e curiosidade científica em uma leitura envolvente.',
    query: 'O mundo assombrado pelos demônios Carl Sagan',
  },
  {
    subject: 'Matemática',
    title: 'O homem que calculava',
    author: 'Malba Tahan',
    isbn: '9788504014464',
    coverUrl: 'https://covers.openlibrary.org/b/id/6828127-L.jpg',
    note: 'Matemática apresentada por meio de histórias e desafios.',
    query: 'O homem que calculava Malba Tahan',
  },
  {
    subject: 'Português',
    title: 'Gramática em textos',
    author: 'Ulisses Infante',
    isbn: '9788526284255',
    coverUrl: null,
    note: 'Apoio prático para estudar língua portuguesa e produção textual.',
    query: 'Gramática em textos Ulisses Infante',
  },
  {
    subject: 'Literatura',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    isbn: '9788535910663',
    coverUrl: 'https://covers.openlibrary.org/b/id/647501-L.jpg',
    note: 'Um clássico brasileiro para ler, interpretar e discutir.',
    query: 'Dom Casmurro Machado de Assis livro',
  },
];

function storeUrl(
  store: 'Amazon' | 'Mercado Livre',
  query: string,
): string {
  const encoded = encodeURIComponent(query);

  return store === 'Amazon'
    ? `https://www.amazon.com.br/s?k=${encoded}`
    : `https://lista.mercadolivre.com.br/${encoded.replace(/%20/g, '-')}`;
}

function CoverPlaceholder({
  book,
}: {
  book: BookRecommendation;
}) {
  return (
    <div
      className="grid h-full place-items-center gap-2 p-3 text-center text-[#005bbf]"
    >
      <BookOpen className="h-8 w-8" aria-hidden="true" />
      <span className="text-[10px] font-bold leading-tight">
        {book.title}
      </span>
    </div>
  );
}

function BookCover({ book }: { book: BookRecommendation }) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <div className="h-48 w-32 shrink-0 overflow-hidden rounded-lg bg-blue-50 shadow-sm dark:bg-blue-950/40 sm:h-44 sm:w-32">
      {!book.coverUrl || hasFailed ? (
        <CoverPlaceholder book={book} />
      ) : (
        <img
          src={book.coverUrl}
          alt={`Capa de ${book.title}`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasFailed(true)}
        />
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<Subject>('Todos');

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');

    return recommendations.filter(
      (book) =>
        (subject === 'Todos' || book.subject === subject) &&
        (!term ||
          `${book.title} ${book.author} ${book.subject}`
            .toLocaleLowerCase('pt-BR')
            .includes(term)),
    );
  }, [search, subject]);

  const customQuery = search.trim();

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <BookOpen
            className="h-7 w-7 text-[#005bbf]"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">
              Acadêmico
            </p>
            <h1 className="text-2xl font-bold text-[#181c20] dark:text-white">
              Indicações de livros
            </h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#727785] dark:text-slate-400">
          Descubra livros para estudar e encontre opções de compra nas principais lojas.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dfe3e8] px-3 py-2 dark:border-slate-700">
          <Search
            className="h-5 w-5 shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <input
            aria-label="Buscar livro, autor ou tema"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex.: O Código Da Vinci, ciência, Paulo Coelho"
            className="w-full min-w-0 bg-transparent text-sm outline-none dark:text-white"
          />
        </label>
        <select
          aria-label="Selecionar categoria"
          value={subject}
          onChange={(event) =>
            setSubject(event.target.value as Subject)
          }
          className="rounded-lg border border-[#dfe3e8] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {subjects.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </section>

      {customQuery && (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            Pesquisar “{customQuery}” nas lojas
          </p>
          <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
            A busca é livre e não fica limitada às recomendações abaixo.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['Amazon', 'Mercado Livre'] as const).map((store) => (
              <a
                key={store}
                href={storeUrl(store, customQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  store === 'Amazon'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white'
                    : 'inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#005bbf] dark:border-blue-800 dark:bg-slate-900'
                }
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Pesquisar no {store}
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-[#181c20] dark:text-white">
          Recomendações por assunto
        </h2>
        <span className="shrink-0 text-xs text-slate-500">
          {visible.length} livros
        </span>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((book) => (
          <article
            key={book.title}
            className="overflow-hidden rounded-xl border border-[#dfe3e8] bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex gap-4 p-5">
              <BookCover book={book} />
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {book.subject}
                </span>
                <h3 className="mt-3 font-bold text-[#181c20] dark:text-white">
                  {book.title}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#005bbf]">
                  {book.author}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
              <p className="min-h-12 text-sm leading-6 text-[#727785] dark:text-slate-400">
                {book.note}
              </p>
              <div
                className="mt-4 flex items-center gap-1 text-amber-500"
                aria-label="Recomendado"
              >
                <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-500">
                  Recomendado para estudo
                </span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(['Amazon', 'Mercado Livre'] as const).map((store) => (
                  <a
                    key={store}
                    href={storeUrl(store, book.query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#cfd7e6] px-3 py-2 text-xs font-bold text-[#005bbf] hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <ExternalLink
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    {store}
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nenhuma indicação encontrada. Use a busca acima para procurar diretamente nas lojas.
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        As capas exibidas foram validadas em catálogo público. O TEC Escola apenas recomenda títulos e direciona para lojas oficiais.
      </p>
    </div>
  );
}

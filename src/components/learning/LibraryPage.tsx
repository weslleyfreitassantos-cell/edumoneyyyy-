import {
  BookOpen,
  ExternalLink,
  Search,
  ShoppingCart,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
    subject: 'História',
    title: 'Uma breve história do tempo',
    author: 'Stephen Hawking',
    isbn: '9788535905409',
    note: 'Uma leitura acessível para conhecer ideias que mudaram a ciência.',
    query: 'Uma breve história do tempo Stephen Hawking',
  },
  {
    subject: 'História',
    title: 'O povo brasileiro',
    author: 'Darcy Ribeiro',
    isbn: '9788526022574',
    note: 'Uma introdução marcante à formação histórica e cultural do Brasil.',
    query: 'O povo brasileiro Darcy Ribeiro',
  },
  {
    subject: 'Ciências',
    title: 'O mundo assombrado pelos demônios',
    author: 'Carl Sagan',
    isbn: '9788535908349',
    note: 'Pensamento crítico e curiosidade científica em uma leitura envolvente.',
    query: 'O mundo assombrado pelos demônios Carl Sagan',
  },
  {
    subject: 'Matemática',
    title: 'O homem que calculava',
    author: 'Malba Tahan',
    isbn: '9788504014464',
    note: 'Matemática apresentada por meio de histórias e desafios.',
    query: 'O homem que calculava Malba Tahan',
  },
  {
    subject: 'Português',
    title: 'Gramática em textos',
    author: 'Ulisses Infante',
    isbn: '9788526284255',
    note: 'Apoio prático para estudar língua portuguesa e produção textual.',
    query: 'Gramática em textos Ulisses Infante',
  },
  {
    subject: 'Literatura',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    isbn: '9788535910663',
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

function openLibraryCoverUrl(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
}

interface GoogleBooksResponse {
  items?: Array<{
    volumeInfo?: {
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }>;
}

function googleBooksCoverUrl(data: GoogleBooksResponse): string | null {
  const imageLinks = data.items?.find(
    (item) => item.volumeInfo?.imageLinks,
  )?.volumeInfo?.imageLinks;
  const url = imageLinks?.thumbnail ?? imageLinks?.smallThumbnail;

  return url?.replace(/^http:\/\//, 'https://') ?? null;
}

function CoverPlaceholder({
  book,
  loading = false,
}: {
  book: BookRecommendation;
  loading?: boolean;
}) {
  return (
    <div
      className="grid h-full place-items-center gap-2 p-3 text-center text-[#005bbf]"
      role={loading ? 'status' : undefined}
      aria-label={loading ? `Carregando capa de ${book.title}` : undefined}
    >
      <BookOpen className="h-8 w-8" aria-hidden="true" />
      <span className="text-[10px] font-bold leading-tight">
        {book.title}
      </span>
    </div>
  );
}

type CoverSource = 'loading' | 'google' | 'open-library' | 'fallback';

function BookCover({ book }: { book: BookRecommendation }) {
  const [source, setSource] = useState<CoverSource>('loading');
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setSource('loading');
    setGoogleUrl(null);

    fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${book.isbn}`,
      { signal: controller.signal },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error('Google Books metadata unavailable');
        }

        return response.json() as Promise<GoogleBooksResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          const coverUrl = googleBooksCoverUrl(data);

          setGoogleUrl(coverUrl);
          setSource(coverUrl ? 'google' : 'open-library');
        }
      })
      .catch((error: unknown) => {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setSource('open-library');
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [book.isbn]);

  const googleCover = source === 'google';
  const imageUrl = googleCover
    ? undefined
    : source === 'open-library'
      ? openLibraryCoverUrl(book.isbn)
      : undefined;

  function handleImageError(): void {
    setSource((current) =>
      current === 'google' ? 'open-library' : 'fallback',
    );
  }

  return (
    <div className="h-48 w-32 shrink-0 overflow-hidden rounded-lg bg-blue-50 shadow-sm dark:bg-blue-950/40 sm:h-44 sm:w-32">
      {source === 'loading' || source === 'fallback' ? (
        <CoverPlaceholder book={book} loading={source === 'loading'} />
      ) : (
        <img
          src={googleCover ? googleUrl ?? '' : imageUrl ?? ''}
          alt={`Capa de ${book.title}`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          data-cover-source={source}
          onError={handleImageError}
        />
      )}
    </div>
  );
}

export default function LibraryPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<Subject>('Todos');
  const [modal, setModal] = useState<{
    store: 'Amazon' | 'Mercado Livre';
    url: string;
  } | null>(null);

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

  function openStore(
    store: 'Amazon' | 'Mercado Livre',
    query: string,
  ): void {
    setModal({ store, url: storeUrl(store, query) });
  }

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
              <button
                key={store}
                type="button"
                onClick={() => openStore(store, customQuery)}
                className={
                  store === 'Amazon'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white'
                    : 'inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#005bbf] dark:border-blue-800 dark:bg-slate-900'
                }
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Pesquisar no {store}
              </button>
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
                  <button
                    key={store}
                    type="button"
                    onClick={() => openStore(store, book.query)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#cfd7e6] px-3 py-2 text-xs font-bold text-[#005bbf] hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <ExternalLink
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                    {store}
                  </button>
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
        As capas são carregadas pelo ISBN em catálogo público. O TEC Escola apenas recomenda títulos e direciona para lojas oficiais.
      </p>

      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pesquisa na ${modal.store}`}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
        >
          <section className="flex h-[min(760px,92vh)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
              <strong className="text-[#181c20] dark:text-white">
                Pesquisa na {modal.store}
              </strong>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Fechar pesquisa"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 flex-1 bg-slate-50 dark:bg-slate-950">
              <iframe
                title={`Resultados da pesquisa na ${modal.store}`}
                src={modal.url}
                className="h-full w-full border-0"
              />
            </div>
            <footer className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-700 sm:flex-row sm:items-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                A loja pode bloquear visualização dentro do TEC por segurança.
              </span>
              <a
                href={modal.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#005bbf] px-3 py-2 text-xs font-bold text-white"
              >
                Abrir na loja
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

import {
  BookOpen,
  CircleAlert,
  ExternalLink,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { useCurrentInstitution } from '../../hooks/useCurrentInstitution';
import {
  useCreateBookRecommendation,
  useSetBookRecommendationActive,
  useStudentBookRecommendations,
  useTeacherBookOfferings,
  useTeacherBookRecommendations,
  useUpdateBookRecommendation,
} from '../../hooks/useBookRecommendations';
import type {
  BookRecommendation,
  BookRecommendationFilters,
  BookRecommendationInput,
  BookRecommendationOffering,
} from '../../services/bookRecommendationService';

type Draft = Omit<BookRecommendationInput, 'institutionId'>;

const EMPTY_DRAFT: Draft = {
  subjectOfferingId: '',
  title: '',
  author: '',
  isbn: '',
  note: '',
  active: true,
};

function storeUrl(store: 'Amazon' | 'Mercado Livre', query: string): string {
  const encoded = encodeURIComponent(query);
  return store === 'Amazon'
    ? `https://www.amazon.com.br/s?k=${encoded}`
    : `https://lista.mercadolivre.com.br/${encoded.replace(/%20/g, '-')}`;
}

function formatOffering(offering: BookRecommendationOffering): string {
  const level = offering.gradeLevel ? ` - ${offering.gradeLevel}` : '';
  const shift = offering.shift ? ` (${offering.shift})` : '';
  return `${offering.className}${level}${shift} • ${offering.subjectName}`;
}

function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div
      className="grid h-full w-full place-items-center gap-2 bg-blue-50 p-3 text-center text-[#005bbf] dark:bg-blue-950/40 dark:text-blue-300"
      data-testid="book-cover-placeholder"
    >
      <BookOpen className="h-9 w-9" aria-hidden="true" />
      <span className="text-[10px] font-bold leading-tight">{title}</span>
    </div>
  );
}

function BookCover({ title }: { title: string }) {
  return (
    <div className="h-44 w-32 shrink-0 overflow-hidden rounded-lg border border-[#dfe3e8] bg-blue-50 dark:border-slate-700 dark:bg-blue-950/40">
      <CoverPlaceholder title={title} />
    </div>
  );
}

function LoadingState() {
  return (
    <section role="status" className="grid min-h-48 place-items-center rounded-2xl border border-[#dfe3e8] bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 text-sm font-medium text-[#727785] dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-[#005bbf]" aria-hidden="true" />
        Carregando indicações...
      </div>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/70 dark:bg-red-950/30">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-red-900 dark:text-red-200">Não foi possível carregar as indicações</h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">Tente atualizar a lista. O acesso continua limitado às turmas permitidas.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  filters,
  offerings,
  isTeacher,
  onChange,
}: {
  filters: BookRecommendationFilters;
  offerings: readonly BookRecommendationOffering[];
  isTeacher: boolean;
  onChange: (next: Partial<BookRecommendationFilters>) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm font-bold text-[#181c20] dark:text-white">
        <Filter className="h-4 w-4 text-[#005bbf]" aria-hidden="true" />
        Filtrar indicações
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="relative block xl:col-span-2">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar indicação"
            value={filters.search ?? ''}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Buscar por título, autor, disciplina ou turma"
            className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white pl-9 pr-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label>
          <span className="sr-only">Turma e disciplina</span>
          <select
            aria-label="Filtrar por turma e disciplina"
            value={filters.subjectOfferingId ?? ''}
            onChange={(event) => onChange({ subjectOfferingId: event.target.value })}
            className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm text-[#181c20] outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Todas as turmas e disciplinas</option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {formatOffering(offering)}
              </option>
            ))}
          </select>
        </label>
        {isTeacher ? (
          <label>
            <span className="sr-only">Status</span>
            <select
              aria-label="Filtrar por status"
              value={filters.status ?? 'all'}
              onChange={(event) => onChange({ status: event.target.value as BookRecommendationFilters['status'] })}
              className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm text-[#181c20] outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}

function RecommendationForm({
  draft,
  offerings,
  editing,
  isPending,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: Draft;
  offerings: readonly BookRecommendationOffering[];
  editing: boolean;
  isPending: boolean;
  error: string | null;
  onChange: (next: Partial<Draft>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section aria-label={editing ? 'Editar indicação' : 'Nova indicação'} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900/70 dark:bg-blue-950/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#181c20] dark:text-white">{editing ? 'Editar indicação' : 'Indicar livro'}</h2>
          <p className="mt-1 text-sm text-[#727785] dark:text-slate-400">A indicação ficará visível somente para os alunos matriculados na turma selecionada.</p>
        </div>
        <button type="button" aria-label="Fechar formulário" onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <label>
          <span className="mb-1 block text-sm font-semibold text-[#181c20] dark:text-white">Título *</span>
          <input aria-label="Título" required maxLength={200} value={draft.title} onChange={(event) => onChange({ title: event.target.value })} className="h-10 w-full rounded-xl border border-[#cfd7e6] bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-[#181c20] dark:text-white">Autor *</span>
          <input aria-label="Autor" required maxLength={200} value={draft.author} onChange={(event) => onChange({ author: event.target.value })} className="h-10 w-full rounded-xl border border-[#cfd7e6] bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-[#181c20] dark:text-white">Turma e disciplina *</span>
          <select aria-label="Turma e disciplina" required value={draft.subjectOfferingId} onChange={(event) => onChange({ subjectOfferingId: event.target.value })} className="h-10 w-full rounded-xl border border-[#cfd7e6] bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">Selecione</option>
            {offerings.map((offering) => <option key={offering.id} value={offering.id}>{formatOffering(offering)}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold text-[#181c20] dark:text-white">ISBN <span className="font-normal text-slate-500">(opcional)</span></span>
          <input aria-label="ISBN" maxLength={32} value={draft.isbn ?? ''} onChange={(event) => onChange({ isbn: event.target.value })} className="h-10 w-full rounded-xl border border-[#cfd7e6] bg-white px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-[#181c20] dark:text-white">Observação <span className="font-normal text-slate-500">(opcional)</span></span>
          <textarea aria-label="Observação" maxLength={2000} rows={3} value={draft.note ?? ''} onChange={(event) => onChange({ note: event.target.value })} className="w-full rounded-xl border border-[#cfd7e6] bg-white px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-[#181c20] dark:text-white">
          <input type="checkbox" checked={draft.active !== false} onChange={(event) => onChange({ active: event.target.checked })} />
          Indicação ativa
        </label>
        {error ? <p role="alert" className="md:col-span-2 text-sm font-medium text-red-700 dark:text-red-300">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
          <button type="button" onClick={onCancel} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cfd7e6] bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Cancelar</button>
          <button type="submit" disabled={isPending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#005bbf] px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {isPending ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar indicação'}
          </button>
        </div>
      </form>
    </section>
  );
}

function RecommendationCard({
  recommendation,
  isTeacher,
  onEdit,
  onSetActive,
  isPending,
}: {
  key?: string;
  recommendation: BookRecommendation;
  isTeacher: boolean;
  onEdit?: () => void;
  onSetActive?: (active: boolean) => void;
  isPending?: boolean;
}) {
  const query = `${recommendation.title} ${recommendation.author}`;

  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${recommendation.active ? 'border-[#dfe3e8] dark:border-slate-800' : 'border-slate-300 opacity-80 dark:border-slate-700'}`}>
      <div className="flex gap-4 p-5">
        <BookCover title={recommendation.title} />
        <div className="min-w-0 flex-1">
          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${recommendation.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {recommendation.active ? 'Ativa' : 'Inativa'}
          </span>
          <h3 className="mt-3 font-bold text-[#181c20] dark:text-white">{recommendation.title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#005bbf] dark:text-blue-300">{recommendation.author}</p>
          <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{recommendation.offering.subjectName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{recommendation.offering.className}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col border-t border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
        <p className="min-h-12 text-sm leading-6 text-[#727785] dark:text-slate-400">{recommendation.note || 'Indicação compartilhada pelo professor para apoiar os estudos.'}</p>
        {recommendation.isbn ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">ISBN: {recommendation.isbn}</p> : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {(['Amazon', 'Mercado Livre'] as const).map((store) => (
            <a key={store} href={storeUrl(store, query)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#cfd7e6] px-3 py-2 text-xs font-bold text-[#005bbf] hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {store}
            </a>
          ))}
          {isTeacher && onEdit && onSetActive ? (
            <div className="flex w-full flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button type="button" aria-label={`Editar ${recommendation.title}`} onClick={onEdit} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-[#005bbf] dark:border-blue-900 dark:text-blue-300"><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</button>
              <button type="button" aria-label={`${recommendation.active ? 'Desativar' : 'Reativar'} ${recommendation.title}`} disabled={isPending} onClick={() => onSetActive(!recommendation.active)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300">
                {recommendation.active ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                {recommendation.active ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function LibraryPage() {
  const { profile } = useAuth();
  const institution = useCurrentInstitution(profile?.id);
  const institutionId = institution.currentInstitutionId;
  const isTeacher = profile?.role === 'TEACHER';
  const [filters, setFilters] = useState<BookRecommendationFilters>({ search: '', subjectOfferingId: '', status: isTeacher ? 'all' : 'active' });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BookRecommendation | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);

  const teacherRecommendations = useTeacherBookRecommendations(institutionId, profile?.id ?? null, filters, isTeacher);
  const studentRecommendations = useStudentBookRecommendations(institutionId, { search: filters.search, subjectOfferingId: filters.subjectOfferingId }, !isTeacher);
  const teacherOfferings = useTeacherBookOfferings(institutionId, profile?.id ?? null, isTeacher);
  const createRecommendation = useCreateBookRecommendation();
  const updateRecommendation = useUpdateBookRecommendation();
  const setRecommendationActive = useSetBookRecommendationActive();

  const recommendations = isTeacher ? teacherRecommendations.data ?? [] : studentRecommendations.data ?? [];
  const activeOfferings = teacherOfferings.data ?? [];
  const filterOfferings = useMemo(() => {
    if (isTeacher) return activeOfferings;
    const unique = new Map<string, BookRecommendationOffering>();
    recommendations.forEach((recommendation) => unique.set(recommendation.offering.id, recommendation.offering));
    return [...unique.values()].sort((left, right) => formatOffering(left).localeCompare(formatOffering(right), 'pt-BR'));
  }, [activeOfferings, isTeacher, recommendations]);
  const isLoading = institution.isLoading || (isTeacher ? teacherRecommendations.isLoading || teacherOfferings.isLoading : studentRecommendations.isLoading);
  const isError = institution.isError || (isTeacher ? teacherRecommendations.isError || teacherOfferings.isError : studentRecommendations.isError);

  function updateFilters(next: Partial<BookRecommendationFilters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(recommendation: BookRecommendation) {
    setEditing(recommendation);
    setDraft({ subjectOfferingId: recommendation.subjectOfferingId, title: recommendation.title, author: recommendation.author, isbn: recommendation.isbn ?? '', note: recommendation.note ?? '', active: recommendation.active });
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!institutionId || !profile?.id) return;
    setFormError(null);
    const input: BookRecommendationInput = { institutionId, ...draft };
    try {
      if (editing) await updateRecommendation.mutateAsync({ id: editing.id, input });
      else await createRecommendation.mutateAsync({ input, createdBy: profile.id });
      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a indicação.');
    }
  }

  function retry() {
    void (isTeacher ? teacherRecommendations.refetch() : studentRecommendations.refetch());
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-[#005bbf]" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#005bbf]">Acadêmico</p>
              <h1 className="text-2xl font-bold text-[#181c20] dark:text-white">Indicações de livros</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-[#727785] dark:text-slate-400">{isTeacher ? 'Compartilhe leituras com suas turmas e disciplinas.' : 'Veja as leituras indicadas pelos professores das suas turmas.'}</p>
        </div>
        {isTeacher ? <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#005bbf] px-4 text-sm font-bold text-white hover:bg-[#004a9c]"><Plus className="h-4 w-4" aria-hidden="true" /> Indicar livro</button> : null}
      </header>

      <FilterBar filters={filters} offerings={filterOfferings} isTeacher={isTeacher} onChange={updateFilters} />

      {filters.search?.trim() ? <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Pesquisar “{filters.search.trim()}” nas lojas</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['Amazon', 'Mercado Livre'] as const).map((store) => <a key={store} href={storeUrl(store, filters.search!.trim())} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-[#005bbf] dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"><ShoppingCart className="h-4 w-4" aria-hidden="true" /> Pesquisar no {store}</a>)}
        </div>
      </section> : null}

      {isTeacher && formOpen ? <RecommendationForm draft={draft} offerings={activeOfferings} editing={Boolean(editing)} isPending={createRecommendation.isPending || updateRecommendation.isPending} error={formError} onChange={(next) => setDraft((current) => ({ ...current, ...next }))} onSubmit={handleSubmit} onCancel={closeForm} /> : null}

      {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={retry} /> : <>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-[#181c20] dark:text-white">{isTeacher ? 'Minhas indicações' : 'Indicações das minhas turmas'}</h2>
          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{recommendations.length} {recommendations.length === 1 ? 'livro' : 'livros'}</span>
        </div>
        {recommendations.length > 0 ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} isTeacher={isTeacher} onEdit={isTeacher ? () => openEdit(recommendation) : undefined} onSetActive={isTeacher ? (active) => setRecommendationActive.mutate({ id: recommendation.id, institutionId: institutionId!, active }) : undefined} isPending={setRecommendationActive.isPending} />)}
        </section> : <section className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <BookOpen className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 text-base font-bold text-[#181c20] dark:text-white">{isTeacher ? 'Você ainda não indicou livros para suas turmas.' : 'Nenhuma indicação disponível para suas turmas.'}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{isTeacher ? 'Crie a primeira indicação escolhendo uma turma e uma disciplina vinculadas ao seu perfil.' : 'Quando um professor indicar uma leitura, ela aparecerá aqui.'}</p>
          {isTeacher ? <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#005bbf] px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" aria-hidden="true" /> Indicar primeiro livro</button> : null}
        </section>}
      </>}
    </div>
  );
}

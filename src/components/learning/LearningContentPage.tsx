import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  CircleAlert,
  Download,
  FileText,
  Filter,
  Link2,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useInstitution } from '../../contexts/InstitutionContext';
import {
  useArchiveLearningPost,
  useCreateLearningPost,
  useDeleteLearningPost,
  useLearningPosts,
  useMarkLearningPostRead,
  useStudentLearningTargets,
  useTeacherLearningTargets,
  useToggleLearningPostPin,
  useUpdateLearningPost,
} from '../../hooks/useLearningContent';
import {
  learningContentService,
  type LearningAttachment,
  type LearningPost,
  type LearningPostFilters,
  type LearningPostType,
  type LearningTarget,
} from '../../services/learningContentService';
import {
  LEARNING_ATTACHMENT_MAX_COUNT,
  validateLearningAttachments,
} from '../../services/learningContentValidation';

const PAGE_SIZE = 20;

interface FilterState extends LearningPostFilters {
  page: number;
}

const initialFilters: FilterState = {
  search: '',
  subjectId: '',
  classId: '',
  postType: 'ALL',
  status: 'active',
  page: 1,
  pageSize: PAGE_SIZE,
};

function formatDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeMeta(postType: LearningPostType) {
  return postType === 'MATERIAL'
    ? {
        label: 'Material',
        Icon: FileText,
        badge: 'bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-300',
      }
    : {
        label: 'Aviso',
        Icon: Megaphone,
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      };
}

function uniqueTargetsBySubject(targets: readonly LearningTarget[]): LearningTarget[] {
  const result = new Map<string, LearningTarget>();
  for (const target of targets) {
    if (!result.has(target.subjectId)) result.set(target.subjectId, target);
  }
  return [...result.values()].sort((left, right) =>
    left.subjectName.localeCompare(right.subjectName, 'pt-BR'),
  );
}

function uniqueTargetsByClass(targets: readonly LearningTarget[], subjectId: string): LearningTarget[] {
  const result = new Map<string, LearningTarget>();
  for (const target of targets) {
    if (target.subjectId === subjectId && !result.has(target.classId)) {
      result.set(target.classId, target);
    }
  }
  return [...result.values()].sort((left, right) =>
    left.className.localeCompare(right.className, 'pt-BR'),
  );
}

function EmptyState({
  isTeacher,
  onCreate,
}: {
  isTeacher: boolean;
  onCreate?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-[#cfd7e6] bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-300">
        <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-bold text-[#181c20] dark:text-white">
        {isTeacher ? 'Nenhuma publicação encontrada' : 'Tudo em dia por aqui'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#727785] dark:text-slate-400">
        {isTeacher
          ? 'Publique um material ou aviso para uma disciplina e turma vinculadas ao seu perfil.'
          : 'Os materiais e avisos das suas turmas aparecerão nesta área.'}
      </p>
      {isTeacher && onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#005bbf] px-4 text-sm font-bold text-white transition hover:bg-[#004a9c] focus:outline-none focus:ring-2 focus:ring-[#005bbf] focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nova publicação
        </button>
      ) : null}
    </section>
  );
}

function LoadingState() {
  return (
    <section role="status" className="grid min-h-48 place-items-center rounded-2xl border border-[#dfe3e8] bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 text-sm font-medium text-[#727785] dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-[#005bbf]" aria-hidden="true" />
        Carregando publicações...
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
          <h2 className="text-sm font-bold text-red-900 dark:text-red-200">Não foi possível carregar as publicações</h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">Tente atualizar a lista. Os dados permanecem protegidos pela instituição atual.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </button>
        </div>
      </div>
    </section>
  );
}

function FilterBar({
  filters,
  onChange,
  subjects,
  classes,
  isTeacher,
}: {
  filters: FilterState;
  onChange: (next: Partial<FilterState>) => void;
  subjects: readonly LearningTarget[];
  classes: readonly LearningTarget[];
  isTeacher: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#181c20] dark:text-white">
          <Filter className="h-4 w-4 text-[#005bbf]" aria-hidden="true" />
          Filtrar publicações
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...initialFilters })}
          className="text-xs font-semibold text-[#005bbf] hover:underline dark:text-blue-300"
        >
          Limpar filtros
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative block xl:col-span-2">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={filters.search ?? ''}
            onChange={(event) => onChange({ search: event.target.value, page: 1 })}
            placeholder="Buscar por título ou conteúdo"
            className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white pl-9 pr-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label>
          <span className="sr-only">Disciplina</span>
          <select
            value={filters.subjectId ?? ''}
            onChange={(event) => onChange({ subjectId: event.target.value, classId: '', page: 1 })}
            className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Todas as disciplinas</option>
            {subjects.map((subject) => <option key={subject.subjectId} value={subject.subjectId}>{subject.subjectName}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Turma</span>
          <select
            value={filters.classId ?? ''}
            onChange={(event) => onChange({ classId: event.target.value, page: 1 })}
            className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Todas as turmas</option>
            {classes.map((item) => <option key={item.classId} value={item.classId}>{item.className}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Tipo</span>
          <select
            value={filters.postType ?? 'ALL'}
            onChange={(event) => onChange({ postType: event.target.value as LearningPostFilters['postType'], page: 1 })}
            className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          >
            <option value="ALL">Todos os tipos</option>
            <option value="MATERIAL">Materiais</option>
            <option value="NOTICE">Avisos</option>
          </select>
        </label>
        {isTeacher ? (
          <label className="md:col-span-2 xl:col-span-1">
            <span className="sr-only">Status</span>
            <select
              value={filters.status ?? 'active'}
              onChange={(event) => onChange({ status: event.target.value as LearningPostFilters['status'], page: 1 })}
              className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="active">Ativos</option>
              <option value="archived">Arquivados</option>
              <option value="all">Todos os status</option>
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}

function AttachmentList({
  attachments,
  canRemove = false,
  removingIds = [],
  onRemove,
}: {
  attachments: readonly LearningAttachment[];
  canRemove?: boolean;
  removingIds?: readonly string[];
  onRemove?: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#e5e9f0] bg-[#f8faff] px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
          <FileText className="h-4 w-4 shrink-0 text-[#005bbf]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#181c20] dark:text-slate-100">{attachment.fileName}</p>
            <p className="text-xs text-[#727785] dark:text-slate-400">{formatFileSize(attachment.sizeBytes)}</p>
          </div>
          {canRemove && onRemove ? (
            <button
              type="button"
              aria-label={`Remover ${attachment.fileName}`}
              title="Remover anexo"
              onClick={() => onRemove(attachment.id)}
              disabled={removingIds.includes(attachment.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function LearningPostCard({
  post,
  isTeacher,
  onOpen,
  onEdit,
  onArchive,
  onDelete,
  onPin,
}: {
  key?: string;
  post: LearningPost;
  isTeacher: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
}) {
  const meta = typeMeta(post.postType);
  const TypeIcon = meta.Icon;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900 ${post.active ? 'border-[#dfe3e8] dark:border-slate-800' : 'border-slate-300 opacity-80 dark:border-slate-700'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.badge}`}>
          <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
        </span>
        <div className="flex items-center gap-1">
          {post.pinned ? <Pin className="h-4 w-4 text-[#005bbf]" aria-label="Fixado" /> : null}
          {isTeacher ? (
            <details className="relative">
              <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Ações da publicação</span>
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-[#dfe3e8] bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {onEdit ? <button type="button" onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" aria-hidden="true" />Editar</button> : null}
                {onPin ? <button type="button" onClick={onPin} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">{post.pinned ? <PinOff className="h-4 w-4" aria-hidden="true" /> : <Pin className="h-4 w-4" aria-hidden="true" />}{post.pinned ? 'Desfixar' : 'Fixar'}</button> : null}
                {post.active && onArchive ? <button type="button" onClick={onArchive} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><Archive className="h-4 w-4" aria-hidden="true" />Arquivar</button> : null}
                {onDelete ? <button type="button" onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" aria-hidden="true" />Excluir</button> : null}
              </div>
            </details>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={onOpen} className="mt-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005bbf] focus-visible:ring-offset-2">
        <h2 className="line-clamp-2 text-lg font-bold leading-6 text-[#181c20] dark:text-white">{post.title}</h2>
        <p className="mt-2 line-clamp-3 min-h-[4.5rem] whitespace-pre-line text-sm leading-6 text-[#727785] dark:text-slate-400">{post.body || 'Sem descrição adicional.'}</p>
      </button>
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#727785] dark:text-slate-400">
          <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{post.subjectName}</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">{post.className}</span>
          {!post.active ? <span className="rounded-lg bg-slate-200 px-2 py-1 dark:bg-slate-700">Arquivado</span> : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#727785] dark:text-slate-500">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatDate(post.publishedAt)}</span>
          {post.attachments.length > 0 ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" aria-hidden="true" />{post.attachments.length} anexo(s)</span> : null}
        </div>
      </div>
    </motion.article>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe3e8] bg-white px-4 py-3 text-sm text-[#727785] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className="rounded-lg border border-[#dfe3e8] px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700">Anterior</button>
        <span className="font-semibold text-[#414754] dark:text-slate-200">Página {page} de {totalPages}</span>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} className="rounded-lg border border-[#dfe3e8] px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-slate-700">Próxima</button>
      </div>
    </div>
  );
}

function PostDetailDialog({
  post,
  onClose,
}: {
  post: LearningPost;
  onClose: () => void;
}) {
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = typeMeta(post.postType);
  const TypeIcon = meta.Icon;

  async function download(attachment: LearningAttachment): Promise<void> {
    setDownloadId(attachment.id);
    setError(null);
    try {
      const url = await learningContentService.createSignedAttachmentUrl(attachment.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Não foi possível abrir o anexo.');
    } finally {
      setDownloadId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="learning-post-detail-title" className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-[#e5e9f0] px-5 py-4 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.badge}`}><TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />{meta.label}</span>
              {post.pinned ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#005bbf]"><Pin className="h-3.5 w-3.5" aria-hidden="true" />Fixado</span> : null}
            </div>
            <h2 id="learning-post-detail-title" className="mt-3 text-xl font-bold text-[#181c20] dark:text-white">{post.title}</h2>
            <p className="mt-1 text-sm text-[#727785] dark:text-slate-400">{post.subjectName} · {post.className} · {formatDate(post.publishedAt)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar detalhe" title="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <p className="whitespace-pre-line text-sm leading-7 text-[#414754] dark:text-slate-300">{post.body || 'Sem descrição adicional.'}</p>
          {post.externalUrl ? <a href={post.externalUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex max-w-full items-center gap-2 break-all rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-[#005bbf] hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"><Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />{post.externalUrl}<ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /></a> : null}
          {post.attachments.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-[#181c20] dark:text-white">Arquivos anexados</h3>
              <div className="mt-2 space-y-2">
                {post.attachments.map((attachment) => (
                  <button key={attachment.id} type="button" onClick={() => void download(attachment)} disabled={downloadId === attachment.id} className="flex w-full items-center gap-3 rounded-xl border border-[#e5e9f0] bg-[#f8faff] px-3 py-3 text-left hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-800">
                    {downloadId === attachment.id ? <Loader2 className="h-5 w-5 animate-spin text-[#005bbf]" aria-hidden="true" /> : <Download className="h-5 w-5 text-[#005bbf]" aria-hidden="true" />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#181c20] dark:text-slate-100">{attachment.fileName}</span><span className="block text-xs text-[#727785] dark:text-slate-400">{formatFileSize(attachment.sizeBytes)}</span></span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
        </div>
        <footer className="flex justify-end border-t border-[#e5e9f0] px-5 py-4 dark:border-slate-800"><button type="button" onClick={onClose} className="rounded-xl border border-[#dfe3e8] px-4 py-2 text-sm font-bold text-[#414754] hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Fechar</button></footer>
      </section>
    </div>
  );
}

interface ComposerProps {
  open: boolean;
  institutionId: string;
  targets: readonly LearningTarget[];
  post: LearningPost | null;
  onClose: () => void;
  onSaved: () => void;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function LearningComposer({ open, institutionId, targets, post, onClose, onSaved }: ComposerProps) {
  const createMutation = useCreateLearningPost();
  const updateMutation = useUpdateLearningPost();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [postType, setPostType] = useState<LearningPostType>('MATERIAL');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const subjectOptions = useMemo(() => uniqueTargetsBySubject(targets), [targets]);
  const classOptions = useMemo(() => uniqueTargetsByClass(targets, subjectId), [targets, subjectId]);
  const existingAttachments = post?.attachments.filter((item) => !removedAttachmentIds.includes(item.id)) ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    setPostType(post?.postType ?? 'MATERIAL');
    setSubjectId(post?.subjectId ?? targets[0]?.subjectId ?? '');
    setClassId(post?.classId ?? '');
    setTitle(post?.title ?? '');
    setBody(post?.body ?? '');
    setExternalUrl(post?.externalUrl ?? '');
    setPinned(post?.pinned ?? false);
    setExpiresAt(toDateTimeLocal(post?.expiresAt ?? null));
    setFiles([]);
    setRemovedAttachmentIds([]);
    setError(null);
  }, [open, post, targets]);

  if (!open) return null;

  const dirty = Boolean(postType !== (post?.postType ?? 'MATERIAL') || subjectId !== (post?.subjectId ?? targets[0]?.subjectId ?? '') || classId !== (post?.classId ?? '') || title !== (post?.title ?? '') || body !== (post?.body ?? '') || externalUrl !== (post?.externalUrl ?? '') || pinned !== (post?.pinned ?? false) || expiresAt !== toDateTimeLocal(post?.expiresAt ?? null) || files.length > 0 || removedAttachmentIds.length > 0);

  function requestClose(): void {
    if (isPending) return;
    if (dirty && !window.confirm('Descartar as alterações não salvas?')) return;
    onClose();
  }

  function addFiles(nextFiles: readonly File[]): void {
    const next = [...files, ...nextFiles];
    const validationError = validateLearningAttachments(next);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setFiles(next);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    addFiles(Array.from(event.target.files ?? []) as File[]);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files) as File[]);
  }

  function validateForm(): string | null {
    if (!subjectId || !classId) return 'Selecione a disciplina e a turma.';
    if (!title.trim()) return 'Informe um título.';
    if (title.trim().length > 160) return 'O título pode ter no máximo 160 caracteres.';
    if (!body.trim()) return 'Informe o conteúdo da publicação.';
    if (externalUrl.trim()) {
      try {
        const url = new URL(externalUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) return 'O link deve começar com http:// ou https://.';
      } catch {
        return 'Informe um link válido ou deixe o campo vazio.';
      }
    }
    return validateLearningAttachments(files);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isPending) return;
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const payload = {
      institutionId,
      classId,
      subjectId,
      postType,
      title,
      body,
      externalUrl,
      pinned,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      files,
    };
    try {
      if (post) {
        await updateMutation.mutateAsync({ ...payload, id: post.id, removeAttachmentIds: removedAttachmentIds });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar a publicação.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-2 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="learning-composer-title" className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-[#e5e9f0] px-5 py-4 dark:border-slate-800">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#005bbf]">{post ? 'Editar publicação' : 'Nova publicação'}</p><h2 id="learning-composer-title" className="mt-1 text-xl font-bold text-[#181c20] dark:text-white">Materiais e avisos</h2><p className="mt-1 text-sm text-[#727785] dark:text-slate-400">Escolha um destino válido para o seu perfil de professor.</p></div>
          <button type="button" onClick={requestClose} aria-label="Fechar" title="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <form onSubmit={(event) => void submit(event)} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <fieldset>
            <legend className="text-sm font-bold text-[#181c20] dark:text-white">Tipo</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(['MATERIAL', 'NOTICE'] as const).map((option) => {
                const meta = typeMeta(option);
                const Icon = meta.Icon;
                const selected = postType === option;
                return <button key={option} type="button" onClick={() => setPostType(option)} className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${selected ? 'border-[#005bbf] bg-blue-50 ring-1 ring-[#005bbf] dark:border-blue-500 dark:bg-blue-950/40' : 'border-[#dfe3e8] hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-800'}`}><span className={`grid h-9 w-9 place-items-center rounded-lg ${meta.badge}`}><Icon className="h-5 w-5" aria-hidden="true" /></span><span><span className="block text-sm font-bold text-[#181c20] dark:text-white">{meta.label}</span><span className="mt-1 block text-xs leading-5 text-[#727785] dark:text-slate-400">{option === 'MATERIAL' ? 'Compartilhe um arquivo, link ou conteúdo de apoio.' : 'Informe a turma sobre uma mudança ou lembrete.'}</span></span>{selected ? <Check className="ml-auto h-5 w-5 text-[#005bbf]" aria-hidden="true" /> : null}</button>;
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-[#e5e9f0] pt-5 dark:border-slate-800">
            <legend className="text-sm font-bold text-[#181c20] dark:text-white">Destino</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#414754] dark:text-slate-200">Disciplina<select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setClassId(''); }} disabled={Boolean(post)} className="mt-1.5 h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm font-normal text-[#181c20] outline-none focus:border-[#005bbf] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"><option value="">Selecione uma disciplina</option>{subjectOptions.map((option) => <option key={option.subjectId} value={option.subjectId}>{option.subjectName}</option>)}</select></label>
              <label className="block text-sm font-semibold text-[#414754] dark:text-slate-200">Turma<select value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!subjectId || Boolean(post)} className="mt-1.5 h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm font-normal text-[#181c20] outline-none focus:border-[#005bbf] disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800"><option value="">{subjectId ? 'Selecione uma turma' : 'Escolha a disciplina primeiro'}</option>{classOptions.map((option) => <option key={option.classId} value={option.classId}>{option.className}</option>)}</select></label>
            </div>
            {post ? <p className="mt-2 text-xs text-[#727785] dark:text-slate-400">O destino é mantido após a publicação para preservar o histórico de acesso.</p> : null}
          </fieldset>

          <fieldset className="mt-6 border-t border-[#e5e9f0] pt-5 dark:border-slate-800">
            <legend className="text-sm font-bold text-[#181c20] dark:text-white">Conteúdo</legend>
            <div className="mt-3 space-y-4">
              <label className="block text-sm font-semibold text-[#414754] dark:text-slate-200">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Ex.: Lista de exercícios da semana" className="mt-1.5 h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm font-normal text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
              <label className="block text-sm font-semibold text-[#414754] dark:text-slate-200">Mensagem<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} maxLength={30000} placeholder="Escreva o conteúdo para a turma..." className="mt-1.5 w-full resize-y rounded-xl border border-[#dfe3e8] bg-white px-3 py-2.5 text-sm font-normal leading-6 text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
              <label className="block text-sm font-semibold text-[#414754] dark:text-slate-200">Link externo <span className="font-normal text-[#727785]">(opcional)</span><span className="relative mt-1.5 block"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} type="url" placeholder="https://..." className="h-10 w-full rounded-xl border border-[#dfe3e8] bg-white pl-9 pr-3 text-sm font-normal text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></span></label>
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-[#e5e9f0] pt-5 dark:border-slate-800">
            <legend className="text-sm font-bold text-[#181c20] dark:text-white">Anexos</legend>
            <div className="mt-3">
              <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`rounded-xl border-2 border-dashed p-5 text-center transition ${isDragging ? 'border-[#005bbf] bg-blue-50 dark:bg-blue-950/40' : 'border-[#cfd7e6] dark:border-slate-700'}`}>
                <Paperclip className="mx-auto h-6 w-6 text-[#005bbf]" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-[#414754] dark:text-slate-200">Arraste os arquivos para cá</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-sm font-bold text-[#005bbf] hover:underline dark:text-blue-300">ou selecione no dispositivo</button>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp" onChange={handleFileChange} className="sr-only" />
                <p className="mt-2 text-xs text-[#727785] dark:text-slate-400">Até {LEARNING_ATTACHMENT_MAX_COUNT} arquivos de 25 MB · PDF, Office, TXT e imagens</p>
              </div>
              {existingAttachments.length > 0 ? <AttachmentList attachments={existingAttachments} canRemove onRemove={(id) => setRemovedAttachmentIds((current) => [...current, id])} /> : null}
              {files.length > 0 ? <div className="mt-2 space-y-2">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl border border-[#e5e9f0] px-3 py-2 dark:border-slate-700"><FileText className="h-4 w-4 shrink-0 text-[#005bbf]" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#181c20] dark:text-slate-100">{file.name}</span><span className="text-xs text-[#727785] dark:text-slate-400">{formatFileSize(file.size)}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remover ${file.name}`} title="Remover anexo" className="grid h-7 w-7 place-items-center rounded-lg text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"><X className="h-4 w-4" aria-hidden="true" /></button></div>)}</div> : null}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-[#e5e9f0] pt-5 dark:border-slate-800">
            <legend className="text-sm font-bold text-[#181c20] dark:text-white">Configurações</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="flex min-h-10 items-center gap-3 rounded-xl border border-[#dfe3e8] px-3 text-sm font-semibold text-[#414754] dark:border-slate-700 dark:text-slate-200"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-4 w-4 accent-[#005bbf]" />Fixar no topo do feed</label>
              <label className="block text-sm font-semibold text-[#414754] dark:text-slate-200">Expira em <span className="font-normal text-[#727785]">(opcional)</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#dfe3e8] bg-white px-3 text-sm font-normal text-[#181c20] outline-none focus:border-[#005bbf] dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            </div>
          </fieldset>

          {error ? <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</div> : null}
          <footer className="mt-6 flex flex-col-reverse gap-3 border-t border-[#e5e9f0] pt-5 sm:flex-row sm:justify-end dark:border-slate-800"><button type="button" onClick={requestClose} disabled={isPending} className="min-h-10 rounded-xl border border-[#dfe3e8] px-4 text-sm font-bold text-[#414754] hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button><button type="submit" disabled={isPending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#005bbf] px-5 text-sm font-bold text-white hover:bg-[#004a9c] disabled:cursor-not-allowed disabled:opacity-60">{isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}{isPending ? 'Salvando...' : post ? 'Salvar alterações' : 'Publicar'}</button></footer>
        </form>
      </section>
    </div>
  );
}

function LearningHeader({
  isTeacher,
  unreadCount,
  onCreate,
}: {
  isTeacher: boolean;
  unreadCount: number;
  onCreate?: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#005bbf]">Acadêmico</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#181c20] dark:text-white">Materiais e avisos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#727785] dark:text-slate-400">{isTeacher ? 'Publique conteúdos para as disciplinas e turmas que você leciona.' : 'Acompanhe conteúdos e comunicados das suas turmas.'}</p>
      </div>
      <div className="flex items-center gap-3">
        {!isTeacher && unreadCount > 0 ? <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-300"><span className="h-2 w-2 rounded-full bg-[#005bbf]" aria-hidden="true" />{unreadCount} não lido(s)</span> : null}
        {isTeacher && onCreate ? <button type="button" onClick={onCreate} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#005bbf] px-4 text-sm font-bold text-white hover:bg-[#004a9c] focus:outline-none focus:ring-2 focus:ring-[#005bbf] focus:ring-offset-2"><Plus className="h-4 w-4" aria-hidden="true" />Nova publicação</button> : null}
      </div>
    </header>
  );
}

function TeacherLearningView({ institutionId, profileId }: { institutionId: string; profileId: string }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<LearningPost | null>(null);
  const [detailPost, setDetailPost] = useState<LearningPost | null>(null);
  const [deletePost, setDeletePost] = useState<LearningPost | null>(null);
  const targetsQuery = useTeacherLearningTargets(institutionId);
  const postsQuery = useLearningPosts(institutionId, profileId, filters);
  const archiveMutation = useArchiveLearningPost();
  const deleteMutation = useDeleteLearningPost();
  const pinMutation = useToggleLearningPostPin();
  const targets = targetsQuery.data ?? [];
  const subjects = useMemo(() => uniqueTargetsBySubject(targets), [targets]);
  const classes = useMemo(() => filters.subjectId ? uniqueTargetsByClass(targets, filters.subjectId) : [...new Map(targets.map((item) => [item.classId, item])).values()].sort((left, right) => left.className.localeCompare(right.className, 'pt-BR')), [targets, filters.subjectId]);
  const posts = postsQuery.data?.posts ?? [];

  function changeFilters(next: Partial<FilterState>): void {
    setFilters((current) => ({ ...current, ...next }));
  }

  function openCreate(): void { setEditingPost(null); setComposerOpen(true); }
  function openEdit(post: LearningPost): void { setEditingPost(post); setComposerOpen(true); }

  return (
    <>
      <LearningHeader isTeacher onCreate={openCreate} unreadCount={0} />
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Publicações', postsQuery.data?.total ?? 0, BookOpenCheck], ['Materiais', posts.filter((post) => post.postType === 'MATERIAL').length, FileText], ['Avisos', posts.filter((post) => post.postType === 'NOTICE').length, Megaphone]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border border-[#dfe3e8] bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-[#727785] dark:text-slate-400">{label}</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#005bbf] dark:bg-blue-950/50 dark:text-blue-300"><Icon className="h-5 w-5" aria-hidden="true" /></span></div><p className="mt-2 text-2xl font-bold text-[#181c20] dark:text-white">{value}</p></div>)}
      </div>
      <FilterBar filters={filters} onChange={changeFilters} subjects={subjects} classes={classes} isTeacher />
      {postsQuery.isLoading ? <LoadingState /> : postsQuery.isError ? <ErrorState onRetry={() => void postsQuery.refetch()} /> : posts.length === 0 ? <EmptyState isTeacher onCreate={openCreate} /> : <><div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{posts.map((post) => <LearningPostCard key={post.id} post={post} isTeacher onOpen={() => setDetailPost(post)} onEdit={() => openEdit(post)} onArchive={() => archiveMutation.mutate(post.id)} onDelete={() => setDeletePost(post)} onPin={() => pinMutation.mutate({ postId: post.id, pinned: !post.pinned })} />)}</div><Pagination page={filters.page} pageSize={PAGE_SIZE} total={postsQuery.data?.total ?? 0} onChange={(page) => changeFilters({ page })} /></>}
      <LearningComposer open={composerOpen} institutionId={institutionId} targets={targets} post={editingPost} onClose={() => setComposerOpen(false)} onSaved={() => { setComposerOpen(false); setEditingPost(null); }} />
      {detailPost ? <PostDetailDialog post={detailPost} onClose={() => setDetailPost(null)} /> : null}
      {deletePost ? <ConfirmDialog title="Excluir publicação?" message="A publicação e seus anexos serão removidos definitivamente." busy={deleteMutation.isPending} onCancel={() => setDeletePost(null)} onConfirm={() => deleteMutation.mutate(deletePost.id, { onSuccess: () => setDeletePost(null) })} /> : null}
    </>
  );
}

function StudentLearningView({ institutionId, profileId }: { institutionId: string; profileId: string }) {
  const [filters, setFilters] = useState<FilterState>({ ...initialFilters, status: 'active' });
  const [detailPost, setDetailPost] = useState<LearningPost | null>(null);
  const postsQuery = useLearningPosts(institutionId, profileId, filters);
  const targetsQuery = useStudentLearningTargets(institutionId);
  const readMutation = useMarkLearningPostRead();
  const posts = postsQuery.data?.posts ?? [];
  const targets = targetsQuery.data ?? [];
  const subjects = useMemo(() => uniqueTargetsBySubject(targets), [targets]);
  const classes = useMemo(() => [...new Map(targets.map((item) => [item.classId, item])).values()], [targets]);
  const unreadCount = posts.filter((post) => !post.isRead).length;

  function openPost(post: LearningPost): void {
    setDetailPost(post);
    if (!post.isRead) readMutation.mutate({ postId: post.id, profileId });
  }

  return (
    <>
      <LearningHeader isTeacher={false} unreadCount={unreadCount} />
      <FilterBar filters={filters} onChange={(next) => setFilters((current) => ({ ...current, ...next }))} subjects={subjects} classes={classes} isTeacher={false} />
      {postsQuery.isLoading ? <LoadingState /> : postsQuery.isError ? <ErrorState onRetry={() => void postsQuery.refetch()} /> : posts.length === 0 ? <EmptyState isTeacher={false} /> : <><div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{posts.map((post) => <LearningPostCard key={post.id} post={post} isTeacher={false} onOpen={() => openPost(post)} />)}</div><Pagination page={filters.page} pageSize={PAGE_SIZE} total={postsQuery.data?.total ?? 0} onChange={(page) => setFilters((current) => ({ ...current, page }))} /></>}
      {detailPost ? <PostDetailDialog post={detailPost} onClose={() => setDetailPost(null)} /> : null}
    </>
  );
}

function ConfirmDialog({
  title,
  message,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4"><section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-[#dfe3e8] bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"><h2 className="text-lg font-bold text-[#181c20] dark:text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-[#727785] dark:text-slate-400">{message}</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-[#dfe3e8] px-4 py-2 text-sm font-bold dark:border-slate-700 dark:text-slate-200">Cancelar</button><button type="button" onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}Excluir</button></div></section></div>;
}

export default function LearningContentPage() {
  const { profile } = useAuth();
  const { currentInstitutionId, currentRole, isLoading } = useInstitution();
  const role = currentRole ?? profile?.role ?? null;

  if (isLoading || !profile || !currentInstitutionId) {
    return <main id="app-main-content" className="min-w-0 flex-1 bg-[#f3f6fb] p-4 sm:p-6 dark:bg-slate-950"><LoadingState /></main>;
  }

  if (role !== 'TEACHER' && role !== 'STUDENT') {
    return <main id="app-main-content" className="min-w-0 flex-1 bg-[#f3f6fb] p-4 sm:p-6 dark:bg-slate-950"><section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">Esta área está disponível apenas para professores e alunos.</section></main>;
  }

  return <main id="app-main-content" className="min-w-0 flex-1 overflow-x-hidden bg-[#f3f6fb] p-4 sm:p-6 dark:bg-slate-950"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">{role === 'TEACHER' ? <TeacherLearningView institutionId={currentInstitutionId} profileId={profile.id} /> : <StudentLearningView institutionId={currentInstitutionId} profileId={profile.id} />}</motion.div></main>;
}

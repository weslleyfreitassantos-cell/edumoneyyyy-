import { supabase } from '../lib/supabaseClient';
import {
  LEARNING_ATTACHMENT_MAX_BYTES,
  LEARNING_ATTACHMENT_MAX_COUNT,
  LEARNING_MATERIALS_BUCKET,
  sanitizeLearningFileName,
  validateLearningAttachments,
} from './learningContentValidation';

export type LearningPostType = 'MATERIAL' | 'NOTICE';
export type LearningPostStatus = 'active' | 'archived' | 'all';

export interface LearningAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
}

export interface LearningTarget {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
}

export interface LearningPost {
  id: string;
  institutionId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  createdBy: string;
  teacherName: string;
  postType: LearningPostType;
  title: string;
  body: string;
  externalUrl: string | null;
  pinned: boolean;
  active: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: LearningAttachment[];
  isRead: boolean;
}

export interface LearningPostFilters {
  search?: string;
  subjectId?: string;
  classId?: string;
  postType?: LearningPostType | 'ALL';
  status?: LearningPostStatus;
  page?: number;
  pageSize?: number;
}

export interface LearningPostPage {
  posts: LearningPost[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SaveLearningPostInput {
  institutionId: string;
  classId: string;
  subjectId: string;
  postType: LearningPostType;
  title: string;
  body: string;
  externalUrl?: string | null;
  pinned?: boolean;
  expiresAt?: string | null;
  files?: readonly File[];
}

export interface UpdateLearningPostInput extends SaveLearningPostInput {
  id: string;
  removeAttachmentIds?: readonly string[];
}

interface RawRow {
  id?: unknown;
  institution_id?: unknown;
  class_id?: unknown;
  subject_id?: unknown;
  created_by?: unknown;
  post_type?: unknown;
  title?: unknown;
  body?: unknown;
  external_url?: unknown;
  pinned?: unknown;
  active?: unknown;
  published_at?: unknown;
  expires_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  subjects?: unknown;
  classes?: unknown;
  profiles?: unknown;
  learning_post_attachments?: unknown;
  learning_post_reads?: unknown;
  profile_id?: unknown;
}

interface RawAttachment {
  post_id?: unknown;
  id?: unknown;
  file_name?: unknown;
  mime_type?: unknown;
  size_bytes?: unknown;
  storage_path?: unknown;
  created_at?: unknown;
}

interface RawRelation {
  id?: unknown;
  name?: unknown;
  code?: unknown;
  full_name?: unknown;
}

const POST_SELECT = `
  id,
  institution_id,
  class_id,
  subject_id,
  created_by,
  post_type,
  title,
  body,
  external_url,
  pinned,
  active,
  published_at,
  expires_at,
  created_at,
  updated_at,
  subjects:subject_id (id, name, code),
  classes:class_id (id, name),
  profiles:created_by (id, full_name)
`;

const POST_ATTACHMENTS_SELECT =
  'post_id, id, file_name, mime_type, size_bytes, storage_path, created_at';

function asRecord(value: unknown): RawRow | RawAttachment | RawRelation {
  return typeof value === 'object' && value !== null
    ? (value as RawRow | RawAttachment | RawRelation)
    : {};
}

function firstRelation(value: unknown): RawRelation {
  return asRecord(Array.isArray(value) ? value[0] : value) as RawRelation;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function normalizeAttachment(value: unknown): LearningAttachment | null {
  const row = asRecord(value) as RawAttachment;
  const id = stringValue(row.id);
  const storagePath = stringValue(row.storage_path);
  if (!id || !storagePath) return null;

  return {
    id,
    fileName: stringValue(row.file_name, 'Arquivo'),
    mimeType: stringValue(row.mime_type, 'application/octet-stream'),
    sizeBytes: numberValue(row.size_bytes),
    storagePath,
    createdAt: stringValue(row.created_at),
  };
}

function normalizePost(
  value: unknown,
  attachmentsByPostId: ReadonlyMap<string, LearningAttachment[]>,
  readPostIds: ReadonlySet<string>,
): LearningPost {
  const row = asRecord(value) as RawRow;
  const subject = firstRelation(row.subjects);
  const classRow = firstRelation(row.classes);
  const profile = firstRelation(row.profiles);
  const id = stringValue(row.id);

  return {
    id,
    institutionId: stringValue(row.institution_id),
    classId: stringValue(row.class_id),
    className: stringValue(classRow.name, 'Turma'),
    subjectId: stringValue(row.subject_id),
    subjectName: stringValue(subject.name, 'Disciplina'),
    subjectCode: nullableString(subject.code),
    createdBy: stringValue(row.created_by),
    teacherName: stringValue(profile.full_name, 'Professor'),
    postType: row.post_type === 'NOTICE' ? 'NOTICE' : 'MATERIAL',
    title: stringValue(row.title),
    body: stringValue(row.body),
    externalUrl: nullableString(row.external_url),
    pinned: row.pinned === true,
    active: row.active !== false,
    publishedAt: stringValue(row.published_at),
    expiresAt: nullableString(row.expires_at),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    attachments: attachmentsByPostId.get(id) ?? [],
    isRead: readPostIds.has(id),
  };
}

function sanitizeSearch(value: string): string {
  return value.replace(/[(),]/g, ' ').trim();
}

function getRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildStoragePath(
  input: Pick<SaveLearningPostInput, 'institutionId' | 'classId' | 'subjectId'>,
  postId: string,
  file: File,
): string {
  return [
    'institution',
    input.institutionId,
    'class',
    input.classId,
    'subject',
    input.subjectId,
    'post',
    postId,
    `${getRandomId()}-${sanitizeLearningFileName(file.name)}`,
  ].join('/');
}

async function removeStoragePaths(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage
    .from(LEARNING_MATERIALS_BUCKET)
    .remove([...paths]);
  if (error) throw error;
}

async function uploadAttachments(
  input: Pick<SaveLearningPostInput, 'institutionId' | 'classId' | 'subjectId'>,
  postId: string,
  files: readonly File[],
): Promise<void> {
  const validationError = validateLearningAttachments(files);
  if (validationError) throw new Error(validationError);
  if (files.length === 0) return;
  if (files.length > LEARNING_ATTACHMENT_MAX_COUNT) {
    throw new Error('Quantidade de anexos inválida.');
  }

  const storage = supabase.storage.from(LEARNING_MATERIALS_BUCKET);
  const uploadedPaths: string[] = [];
  const records = [] as Array<Record<string, unknown>>;

  try {
    for (const file of files) {
      if (file.size > LEARNING_ATTACHMENT_MAX_BYTES) {
        throw new Error(`${file.name} excede o limite de 25 MB.`);
      }
      const path = buildStoragePath(input, postId, file);
      const { error } = await storage.upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      uploadedPaths.push(path);
      records.push({
        post_id: postId,
        storage_path: path,
        file_name: sanitizeLearningFileName(file.name),
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    const { error: insertError } = await supabase
      .from('learning_post_attachments')
      .insert(records);
    if (insertError) throw insertError;
  } catch (error) {
    try {
      await removeStoragePaths(uploadedPaths);
    } catch {
      // The original error is more useful to the user; a later cleanup can remove leftovers.
    }
    throw error;
  }
}

async function loadPostAttachmentsForPosts(
  postIds: readonly string[],
): Promise<Map<string, LearningAttachment[]>> {
  const attachmentsByPostId = new Map<string, LearningAttachment[]>();
  if (postIds.length === 0) return attachmentsByPostId;

  const { data, error } = await supabase
    .from('learning_post_attachments')
    .select(POST_ATTACHMENTS_SELECT)
    .in('post_id', [...postIds])
    .order('created_at', { ascending: true });
  if (error) throw error;

  for (const value of data ?? []) {
    const row = asRecord(value) as RawAttachment;
    const postId = stringValue(row.post_id);
    const attachment = normalizeAttachment(value);
    if (!postId || !attachment) continue;
    const current = attachmentsByPostId.get(postId) ?? [];
    current.push(attachment);
    attachmentsByPostId.set(postId, current);
  }

  return attachmentsByPostId;
}

async function loadPostAttachments(postId: string): Promise<LearningAttachment[]> {
  const attachmentsByPostId = await loadPostAttachmentsForPosts([postId]);
  return attachmentsByPostId.get(postId) ?? [];
}

async function loadReadPostIds(
  postIds: readonly string[],
  profileId: string,
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from('learning_post_reads')
    .select('post_id')
    .in('post_id', [...postIds])
    .eq('profile_id', profileId);
  if (error) throw error;

  return new Set(
    (data ?? [])
      .map((row) => stringValue((asRecord(row) as { post_id?: unknown }).post_id))
      .filter(Boolean),
  );
}

interface ListPostsOptions {
  includeReadState?: boolean;
}

export const learningContentService = {
  async listPosts(
    institutionId: string,
    profileId: string,
    filters: LearningPostFilters = {},
    options: ListPostsOptions = {},
  ): Promise<LearningPostPage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(20, Math.max(1, filters.pageSize ?? 20));
    let query = supabase
      .from('learning_posts')
      .select(POST_SELECT, { count: 'exact' })
      .eq('institution_id', institutionId)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.classId) query = query.eq('class_id', filters.classId);
    if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);
    if (filters.postType && filters.postType !== 'ALL') {
      query = query.eq('post_type', filters.postType);
    }
    if (filters.status === 'active') query = query.eq('active', true);
    if (filters.status === 'archived') query = query.eq('active', false);
    if (filters.search?.trim()) {
      const term = sanitizeSearch(filters.search.trim());
      query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const rawPosts = data ?? [];
    const postIds = rawPosts
      .map((row) => stringValue(asRecord(row).id))
      .filter(Boolean);
    const [attachmentsByPostId, readPostIds] = await Promise.all([
      loadPostAttachmentsForPosts(postIds),
      options.includeReadState === false
        ? Promise.resolve(new Set<string>())
        : loadReadPostIds(postIds, profileId),
    ]);

    return {
      posts: rawPosts.map((row) => normalizePost(row, attachmentsByPostId, readPostIds)),
      total: count ?? data?.length ?? 0,
      page,
      pageSize,
    };
  },

  async listTeacherTargets(institutionId: string): Promise<LearningTarget[]> {
    const [teacherSubjectsResult, curriculumResult] = await Promise.all([
      supabase
        .from('teacher_subjects')
        .select('subject_id')
        .eq('institution_id', institutionId)
        .eq('active', true),
      supabase
        .from('class_curriculum_items')
        .select('class_id, subject_id, classes:class_id(id, name), subjects:subject_id(id, name, code)')
        .eq('institution_id', institutionId)
        .eq('active', true),
    ]);

    if (teacherSubjectsResult.error) throw teacherSubjectsResult.error;
    if (curriculumResult.error) throw curriculumResult.error;

    const subjectIds = new Set(
      (teacherSubjectsResult.data ?? []).map((row) => String(row.subject_id)),
    );
    const targets = new Map<string, LearningTarget>();

    for (const value of curriculumResult.data ?? []) {
      const row = asRecord(value) as RawRow;
      const subject = firstRelation(row.subjects);
      const classRow = firstRelation(row.classes);
      const subjectId = stringValue(row.subject_id);
      const classId = stringValue(row.class_id);
      if (!subjectIds.has(subjectId) || !subjectId || !classId) continue;
      targets.set(`${classId}:${subjectId}`, {
        classId,
        className: stringValue(classRow.name, 'Turma'),
        subjectId,
        subjectName: stringValue(subject.name, 'Disciplina'),
        subjectCode: nullableString(subject.code),
      });
    }

    return [...targets.values()].sort((left, right) =>
      `${left.subjectName} ${left.className}`.localeCompare(
        `${right.subjectName} ${right.className}`,
        'pt-BR',
      ),
    );
  },

  async listStudentTargets(institutionId: string): Promise<LearningTarget[]> {
    const [enrollmentsResult, curriculumResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select('class_id, classes:class_id(id, name)')
        .eq('active', true)
        .eq('status', 'active'),
      supabase
        .from('class_curriculum_items')
        .select('class_id, subject_id, classes:class_id(id, name), subjects:subject_id(id, name, code)')
        .eq('institution_id', institutionId)
        .eq('active', true),
    ]);

    if (enrollmentsResult.error) throw enrollmentsResult.error;
    if (curriculumResult.error) throw curriculumResult.error;

    const classIds = new Set(
      (enrollmentsResult.data ?? []).map((row) => String(row.class_id)),
    );
    const targets = new Map<string, LearningTarget>();

    for (const value of curriculumResult.data ?? []) {
      const row = asRecord(value) as RawRow;
      const subject = firstRelation(row.subjects);
      const classRow = firstRelation(row.classes);
      const classId = stringValue(row.class_id);
      const subjectId = stringValue(row.subject_id);
      if (!classIds.has(classId) || !classId || !subjectId) continue;
      targets.set(`${classId}:${subjectId}`, {
        classId,
        className: stringValue(classRow.name, 'Turma'),
        subjectId,
        subjectName: stringValue(subject.name, 'Disciplina'),
        subjectCode: nullableString(subject.code),
      });
    }

    return [...targets.values()].sort((left, right) =>
      `${left.subjectName} ${left.className}`.localeCompare(
        `${right.subjectName} ${right.className}`,
        'pt-BR',
      ),
    );
  },

  async createPost(input: SaveLearningPostInput): Promise<void> {
    const files = input.files ?? [];
    const validationError = validateLearningAttachments(files);
    if (validationError) throw new Error(validationError);

    const { data, error } = await supabase
      .from('learning_posts')
      .insert({
        institution_id: input.institutionId,
        class_id: input.classId,
        subject_id: input.subjectId,
        post_type: input.postType,
        title: input.title.trim(),
        body: input.body.trim(),
        external_url: input.externalUrl?.trim() || null,
        pinned: input.pinned ?? false,
        expires_at: input.expiresAt || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    const postId = stringValue(data?.id);
    if (!postId) throw new Error('A publicação não foi criada corretamente.');

    try {
      await uploadAttachments(input, postId, files);
    } catch (uploadError) {
      await supabase.from('learning_posts').delete().eq('id', postId);
      throw uploadError;
    }
  },

  async updatePost(input: UpdateLearningPostInput): Promise<void> {
    const files = input.files ?? [];
    const validationError = validateLearningAttachments(files);
    if (validationError) throw new Error(validationError);

    const { error } = await supabase
      .from('learning_posts')
      .update({
        post_type: input.postType,
        title: input.title.trim(),
        body: input.body.trim(),
        external_url: input.externalUrl?.trim() || null,
        pinned: input.pinned ?? false,
        expires_at: input.expiresAt || null,
      })
      .eq('id', input.id);
    if (error) throw error;

    const removeIds = [...new Set(input.removeAttachmentIds ?? [])];
    if (removeIds.length > 0) {
      const currentAttachments = await loadPostAttachments(input.id);
      const attachmentsToRemove = currentAttachments.filter((item) => removeIds.includes(item.id));
      await removeStoragePaths(attachmentsToRemove.map((item) => item.storagePath));
      const { error: removeError } = await supabase
        .from('learning_post_attachments')
        .delete()
        .in('id', attachmentsToRemove.map((item) => item.id));
      if (removeError) throw removeError;
    }

    await uploadAttachments(input, input.id, files);
  },

  async archivePost(postId: string): Promise<void> {
    const { error } = await supabase
      .from('learning_posts')
      .update({ active: false })
      .eq('id', postId);
    if (error) throw error;
  },

  async togglePinned(postId: string, pinned: boolean): Promise<void> {
    const { error } = await supabase
      .from('learning_posts')
      .update({ pinned })
      .eq('id', postId);
    if (error) throw error;
  },

  async deletePost(postId: string): Promise<void> {
    const attachments = await loadPostAttachments(postId);
    await removeStoragePaths(attachments.map((item) => item.storagePath));
    const { error } = await supabase
      .from('learning_posts')
      .delete()
      .eq('id', postId);
    if (error) throw error;
  },

  async markPostRead(postId: string, profileId: string): Promise<void> {
    const { error } = await supabase
      .from('learning_post_reads')
      .upsert(
        { post_id: postId, profile_id: profileId, read_at: new Date().toISOString() },
        { onConflict: 'post_id,profile_id' },
      );
    if (error) throw error;
  },

  async createSignedAttachmentUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(LEARNING_MATERIALS_BUCKET)
      .createSignedUrl(storagePath, 300);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('Não foi possível preparar o download.');
    return data.signedUrl;
  },
};

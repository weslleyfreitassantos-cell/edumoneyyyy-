import { supabase } from '../lib/supabaseClient';
import {
  BOOK_RECOMMENDATION_COVER_MAX_BYTES,
  BOOK_RECOMMENDATION_COVER_MIME_TYPES,
  validateBookRecommendationCover,
} from './bookRecommendationValidation';

export {
  BOOK_RECOMMENDATION_COVER_MAX_BYTES,
  BOOK_RECOMMENDATION_COVER_MIME_TYPES,
  validateBookRecommendationCover,
} from './bookRecommendationValidation';

export type BookRecommendationStatus = 'active' | 'inactive' | 'all';

export const BOOK_RECOMMENDATION_COVERS_BUCKET = 'book-recommendation-covers';

export interface BookRecommendationFilters {
  search?: string;
  subjectOfferingId?: string;
  status?: BookRecommendationStatus;
}

export interface BookRecommendationOffering {
  id: string;
  classId: string;
  subjectId: string;
  teacherProfileId: string;
  className: string;
  gradeLevel: string | null;
  shift: string | null;
  subjectName: string;
  subjectCode: string | null;
  termName: string;
  active: boolean;
}

export interface BookRecommendation {
  id: string;
  institutionId: string;
  subjectOfferingId: string;
  title: string;
  author: string;
  isbn: string | null;
  note: string | null;
  coverPath: string | null;
  coverUrl: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  offering: BookRecommendationOffering;
}

export interface BookRecommendationInput {
  institutionId: string;
  subjectOfferingId: string;
  title: string;
  author: string;
  isbn?: string | null;
  note?: string | null;
  active?: boolean;
}

export interface BookRecommendationMutationResult {
  recommendation: BookRecommendation;
  coverUploadError: string | null;
}

interface RawRecord {
  [key: string]: unknown;
}

const OFFERING_SELECT = `
  id,
  class_id,
  subject_id,
  teacher_profile_id,
  term_id,
  active,
  classes:class_id (
    id,
    institution_id,
    name,
    grade_level,
    shift,
    active
  ),
  subjects:subject_id (
    id,
    institution_id,
    name,
    code,
    active
  ),
  terms:term_id (
    id,
    name,
    active
  )
`;

const RECOMMENDATION_SELECT = `
  id,
  institution_id,
  subject_offering_id,
  title,
  author,
  isbn,
  note,
  cover_path,
  active,
  created_by,
  created_at,
  updated_at,
  subject_offering:subject_offering_id (
    ${OFFERING_SELECT}
  )
`;

function asRecord(value: unknown): RawRecord {
  return typeof value === 'object' && value !== null
    ? (value as RawRecord)
    : {};
}

function firstRelation(value: unknown): RawRecord {
  return asRecord(Array.isArray(value) ? value[0] : value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : null;
}

function booleanValue(value: unknown): boolean {
  return value !== false;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível salvar a capa.';
}

function normalizeOffering(
  value: unknown,
  institutionId?: string,
): BookRecommendationOffering | null {
  const row = firstRelation(value);
  const classRow = firstRelation(row.classes);
  const subjectRow = firstRelation(row.subjects);
  const termRow = firstRelation(row.terms);
  const id = stringValue(row.id);
  const classId = stringValue(row.class_id);
  const subjectId = stringValue(row.subject_id);
  const teacherProfileId = stringValue(row.teacher_profile_id);
  const className = stringValue(classRow.name);
  const subjectName = stringValue(subjectRow.name);

  if (
    !id ||
    !classId ||
    !subjectId ||
    !teacherProfileId ||
    !className ||
    !subjectName ||
    classRow.active === false ||
    subjectRow.active === false ||
    (institutionId &&
      (classRow.institution_id !== institutionId ||
        subjectRow.institution_id !== institutionId))
  ) {
    return null;
  }

  return {
    id,
    classId,
    subjectId,
    teacherProfileId,
    className,
    gradeLevel: nullableString(classRow.grade_level),
    shift: nullableString(classRow.shift),
    subjectName,
    subjectCode: nullableString(subjectRow.code),
    termName: stringValue(termRow.name, 'Período atual'),
    active: booleanValue(row.active),
  };
}

function normalizeRecommendation(
  value: unknown,
  coverUrl: string | null = null,
): BookRecommendation | null {
  const row = asRecord(value);
  const id = stringValue(row.id);
  const institutionId = stringValue(row.institution_id);
  const subjectOfferingId = stringValue(row.subject_offering_id);
  const title = stringValue(row.title);
  const author = stringValue(row.author);
  const offering = normalizeOffering(row.subject_offering, institutionId);

  if (!id || !institutionId || !subjectOfferingId || !title || !author || !offering) {
    return null;
  }

  return {
    id,
    institutionId,
    subjectOfferingId,
    title,
    author,
    isbn: nullableString(row.isbn),
    note: nullableString(row.note),
    coverPath: nullableString(row.cover_path),
    coverUrl,
    active: booleanValue(row.active),
    createdBy: stringValue(row.created_by),
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    offering,
  };
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('pt-BR') ?? '';
}

export function matchesBookRecommendationFilters(
  recommendation: BookRecommendation,
  filters: BookRecommendationFilters = {},
): boolean {
  const status = filters.status ?? 'active';
  if (status === 'active' && !recommendation.active) return false;
  if (status === 'inactive' && recommendation.active) return false;
  if (
    filters.subjectOfferingId &&
    recommendation.subjectOfferingId !== filters.subjectOfferingId
  ) {
    return false;
  }

  const search = normalizeSearch(filters.search);
  if (!search) return true;

  return [
    recommendation.title,
    recommendation.author,
    recommendation.offering.className,
    recommendation.offering.subjectName,
    recommendation.note ?? '',
  ]
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .includes(search);
}

export function validateBookRecommendationInput(
  input: BookRecommendationInput,
): BookRecommendationInput {
  const title = input.title.trim();
  const author = input.author.trim();
  const subjectOfferingId = input.subjectOfferingId.trim();
  const isbn = input.isbn?.trim() || null;
  const note = input.note?.trim() || null;

  if (!input.institutionId.trim()) {
    throw new Error('A instituição da indicação é obrigatória.');
  }
  if (!subjectOfferingId) {
    throw new Error('Selecione a turma e a disciplina da indicação.');
  }
  if (!title || title.length > 200) {
    throw new Error('O título deve ter entre 1 e 200 caracteres.');
  }
  if (!author || author.length > 200) {
    throw new Error('O autor deve ter entre 1 e 200 caracteres.');
  }
  if (isbn && isbn.length > 32) {
    throw new Error('O ISBN deve ter no máximo 32 caracteres.');
  }
  if (note && note.length > 2000) {
    throw new Error('A observação deve ter no máximo 2.000 caracteres.');
  }

  return {
    institutionId: input.institutionId.trim(),
    subjectOfferingId,
    title,
    author,
    isbn,
    note,
    active: input.active !== false,
  };
}

function sortRecommendations(
  recommendations: BookRecommendation[],
): BookRecommendation[] {
  return recommendations.sort((left, right) =>
    left.title.localeCompare(right.title, 'pt-BR'),
  );
}

async function hydrateCoverUrls(
  recommendations: BookRecommendation[],
): Promise<BookRecommendation[]> {
  const paths = [...new Set(
    recommendations
      .map((recommendation) => recommendation.coverPath)
      .filter((path): path is string => Boolean(path)),
  )];
  if (paths.length === 0) return recommendations;

  const { data, error } = await supabase.storage
    .from(BOOK_RECOMMENDATION_COVERS_BUCKET)
    .createSignedUrls(paths, 300);
  if (error || !data) return recommendations;

  const urls = new Map(
    data
      .filter((item) => typeof item?.path === 'string' && typeof item.signedUrl === 'string')
      .map((item) => [item.path, item.signedUrl]),
  );

  return recommendations.map((recommendation) => ({
    ...recommendation,
    coverUrl: recommendation.coverPath ? urls.get(recommendation.coverPath) ?? null : null,
  }));
}

function getRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function coverExtension(file: File): string {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function buildCoverPath(recommendation: BookRecommendation, file: File): string {
  return `${recommendation.institutionId}/${recommendation.id}/${getRandomId()}.${coverExtension(file)}`;
}

function createMutationResult(
  recommendation: BookRecommendation,
  coverUploadError: string | null = null,
): BookRecommendationMutationResult {
  return { recommendation, coverUploadError };
}

export const bookRecommendationService = {
  async listForTeacher(
    institutionId: string,
    profileId: string,
    filters: BookRecommendationFilters = {},
  ): Promise<BookRecommendation[]> {
    const { data, error } = await supabase
      .from('book_recommendations')
      .select(RECOMMENDATION_SELECT)
      .eq('institution_id', institutionId)
      .eq('created_by', profileId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const recommendations = sortRecommendations(
      (data ?? [])
        .map((row) => normalizeRecommendation(row))
        .filter((row): row is BookRecommendation => row !== null)
        .filter((row) => matchesBookRecommendationFilters(row, filters)),
    );
    return hydrateCoverUrls(recommendations);
  },

  async listForStudent(
    institutionId: string,
    filters: Omit<BookRecommendationFilters, 'status'> = {},
  ): Promise<BookRecommendation[]> {
    const { data, error } = await supabase
      .from('book_recommendations')
      .select(RECOMMENDATION_SELECT)
      .eq('institution_id', institutionId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const recommendations = sortRecommendations(
      (data ?? [])
        .map((row) => normalizeRecommendation(row))
        .filter((row): row is BookRecommendation => row !== null)
        .filter((row) => matchesBookRecommendationFilters(row, { ...filters, status: 'active' })),
    );
    return hydrateCoverUrls(recommendations);
  },

  async listTeacherOfferings(
    institutionId: string,
    profileId: string,
  ): Promise<BookRecommendationOffering[]> {
    const { data, error } = await supabase
      .from('subject_offerings')
      .select(OFFERING_SELECT)
      .eq('teacher_profile_id', profileId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? [])
      .map((row) => normalizeOffering(row, institutionId))
      .filter((row): row is BookRecommendationOffering =>
        row !== null && row.teacherProfileId === profileId,
      )
      .sort((left, right) => {
        const classComparison = left.className.localeCompare(right.className, 'pt-BR');
        return classComparison || left.subjectName.localeCompare(right.subjectName, 'pt-BR');
      });
  },

  async create(
    input: BookRecommendationInput,
    createdBy: string,
  ): Promise<BookRecommendation> {
    const normalized = validateBookRecommendationInput(input);
    const { data, error } = await supabase
      .from('book_recommendations')
      .insert({
        institution_id: normalized.institutionId,
        subject_offering_id: normalized.subjectOfferingId,
        title: normalized.title,
        author: normalized.author,
        isbn: normalized.isbn,
        note: normalized.note,
        active: normalized.active,
        created_by: createdBy,
      })
      .select(RECOMMENDATION_SELECT)
      .single();

    if (error) throw error;
    const recommendation = normalizeRecommendation(data);
    if (!recommendation) throw new Error('A indicação criada não retornou seus dados.');
    return recommendation;
  },

  async createWithCover(
    input: BookRecommendationInput,
    createdBy: string,
    coverFile?: File | null,
  ): Promise<BookRecommendationMutationResult> {
    const recommendation = await this.create(input, createdBy);
    if (!coverFile) return createMutationResult(recommendation);

    try {
      return createMutationResult(await this.uploadCover(recommendation, coverFile));
    } catch (error) {
      return createMutationResult(recommendation, errorMessage(error));
    }
  },

  async update(
    id: string,
    input: BookRecommendationInput,
  ): Promise<BookRecommendation> {
    const normalized = validateBookRecommendationInput(input);
    const { data, error } = await supabase
      .from('book_recommendations')
      .update({
        subject_offering_id: normalized.subjectOfferingId,
        title: normalized.title,
        author: normalized.author,
        isbn: normalized.isbn,
        note: normalized.note,
        active: normalized.active,
      })
      .eq('id', id)
      .eq('institution_id', normalized.institutionId)
      .select(RECOMMENDATION_SELECT)
      .single();

    if (error) throw error;
    const recommendation = normalizeRecommendation(data);
    if (!recommendation) throw new Error('A indicação atualizada não retornou seus dados.');
    return recommendation;
  },

  async updateWithCover(
    id: string,
    input: BookRecommendationInput,
    options: { coverFile?: File | null; removeCover?: boolean } = {},
  ): Promise<BookRecommendationMutationResult> {
    const recommendation = await this.update(id, input);
    if (options.coverFile) {
      try {
        return createMutationResult(await this.uploadCover(recommendation, options.coverFile));
      } catch (error) {
        return createMutationResult(recommendation, errorMessage(error));
      }
    }
    if (options.removeCover) {
      try {
        return createMutationResult(await this.removeCover(recommendation));
      } catch (error) {
        return createMutationResult(recommendation, errorMessage(error));
      }
    }
    return createMutationResult(recommendation);
  },

  async uploadCover(
    recommendation: BookRecommendation,
    file: File,
  ): Promise<BookRecommendation> {
    const validationError = validateBookRecommendationCover(file);
    if (validationError) throw new Error(validationError);

    const path = buildCoverPath(recommendation, file);
    const storage = supabase.storage.from(BOOK_RECOMMENDATION_COVERS_BUCKET);
    const { error: uploadError } = await storage.upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data, error: updateError } = await supabase
      .from('book_recommendations')
      .update({ cover_path: path })
      .eq('id', recommendation.id)
      .eq('institution_id', recommendation.institutionId)
      .select(RECOMMENDATION_SELECT)
      .single();

    if (updateError) {
      await storage.remove([path]).catch(() => undefined);
      throw updateError;
    }

    const updated = normalizeRecommendation(data);
    if (!updated) {
      await storage.remove([path]).catch(() => undefined);
      throw new Error('A capa foi enviada, mas a indicação não retornou seus dados.');
    }

    if (recommendation.coverPath && recommendation.coverPath !== path) {
      await storage.remove([recommendation.coverPath]).catch(() => undefined);
    }

    const [withUrl] = await hydrateCoverUrls([updated]);
    return withUrl;
  },

  async removeCover(recommendation: BookRecommendation): Promise<BookRecommendation> {
    if (!recommendation.coverPath) return recommendation;

    const { data, error } = await supabase
      .from('book_recommendations')
      .update({ cover_path: null })
      .eq('id', recommendation.id)
      .eq('institution_id', recommendation.institutionId)
      .select(RECOMMENDATION_SELECT)
      .single();
    if (error) throw error;

    const updated = normalizeRecommendation(data);
    if (!updated) throw new Error('A indicação atualizada não retornou seus dados.');

    await supabase.storage
      .from(BOOK_RECOMMENDATION_COVERS_BUCKET)
      .remove([recommendation.coverPath])
      .catch(() => undefined);
    return updated;
  },

  async setActive(
    id: string,
    institutionId: string,
    active: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from('book_recommendations')
      .update({ active })
      .eq('id', id)
      .eq('institution_id', institutionId);

    if (error) throw error;
  },
};

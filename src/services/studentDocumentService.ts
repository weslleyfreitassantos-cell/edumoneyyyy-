import { supabase } from '../lib/supabaseClient';

export const STUDENT_DOCUMENTS_BUCKET = 'student-documents';
export const STUDENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const STUDENT_DOCUMENT_ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

const mimeByExtension: Record<string, string> = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  webp: 'image/webp',
};

export interface StudentDocumentFileDraft {
  document_type: string;
  file?: File | null;
  file_path?: string | null;
}

function normalizePathSegment(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'documento';
}

function getFileExtension(file: File): string {
  return file.name.split('.').pop()?.trim().toLocaleLowerCase('pt-BR') ?? '';
}

function resolveFileMimeType(file: File): string | null {
  if (STUDENT_DOCUMENT_ACCEPT.split(',').includes(file.type)) return file.type;
  return mimeByExtension[getFileExtension(file)] ?? null;
}

function buildStoragePath(
  institutionId: string,
  studentId: string,
  documentType: string,
  file: File,
): string {
  const extension = getFileExtension(file);
  const suffix = extension ? `.${extension}` : '';
  return `${institutionId}/${studentId}/${normalizePathSegment(documentType)}-${crypto.randomUUID()}${suffix}`;
}

function validateDocumentFile(file: File): string {
  if (file.size <= 0) return 'O arquivo selecionado está vazio.';
  if (file.size > STUDENT_DOCUMENT_MAX_BYTES) return 'Cada documento pode ter no máximo 10 MB.';
  if (!resolveFileMimeType(file)) return 'Formato não permitido. Envie PDF, DOC, DOCX, JPG, PNG ou WEBP.';
  return '';
}

export async function uploadStudentDocumentFiles(
  institutionId: string,
  studentId: string,
  documents: readonly StudentDocumentFileDraft[],
): Promise<void> {
  const documentsWithFiles = documents.filter((document) => document.file);
  if (documentsWithFiles.length === 0) return;

  const storage = supabase.storage.from(STUDENT_DOCUMENTS_BUCKET);
  const uploadedPaths: string[] = [];
  const updatedDocuments: Array<{ documentType: string; previousPath: string | null }> = [];

  try {
    for (const document of documentsWithFiles) {
      const file = document.file as File;
      const validationError = validateDocumentFile(file);
      if (validationError) throw new Error(`${document.document_type}: ${validationError}`);

      const contentType = resolveFileMimeType(file) as string;
      const path = buildStoragePath(institutionId, studentId, document.document_type, file);
      const { error: uploadError } = await storage.upload(path, file, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      const { data: updatedRow, error: updateError } = await supabase
        .from('student_documents')
        .update({ file_path: path, updated_at: new Date().toISOString() })
        .eq('institution_id', institutionId)
        .eq('student_id', studentId)
        .eq('document_type', document.document_type)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updatedRow?.id) throw new Error('STUDENT_DOCUMENT_RECORD_NOT_PERSISTED');

      updatedDocuments.push({
        documentType: document.document_type,
        previousPath: document.file_path ?? null,
      });
    }

    const previousPaths = updatedDocuments
      .map((document) => document.previousPath)
      .filter((path): path is string => Boolean(path));
    if (previousPaths.length > 0) {
      await storage.remove(previousPaths).catch(() => undefined);
    }
  } catch (error) {
    await storage.remove(uploadedPaths).catch(() => undefined);
    await Promise.all(
      updatedDocuments.map((document) =>
        Promise.resolve(
          supabase
            .from('student_documents')
            .update({ file_path: document.previousPath, updated_at: new Date().toISOString() })
            .eq('institution_id', institutionId)
            .eq('student_id', studentId)
            .eq('document_type', document.documentType)
            .select('id')
            .maybeSingle()
            .then(() => undefined),
        )
          .catch(() => undefined),
      ),
    );
    throw error;
  }
}

export async function createStudentDocumentSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Não foi possível abrir o documento armazenado.');
  return data.signedUrl;
}

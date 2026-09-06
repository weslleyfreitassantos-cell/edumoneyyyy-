export const LEARNING_MATERIALS_BUCKET = 'learning-materials';
export const LEARNING_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const LEARNING_ATTACHMENT_MAX_COUNT = 5;

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
};

export const LEARNING_ACCEPTED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

export interface AttachmentValidationResult {
  valid: boolean;
  message?: string;
}

function getExtension(fileName: string): string {
  const extension = fileName.split('.').pop() ?? '';
  return extension.trim().toLowerCase();
}

export function getLearningFileExtension(fileName: string): string {
  return getExtension(fileName);
}

export function sanitizeLearningFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? 'arquivo';
  const normalized = baseName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safeName = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-\./g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 180);

  return safeName || `arquivo.${getExtension(baseName) || 'bin'}`;
}

export function validateLearningAttachment(
  file: File,
): AttachmentValidationResult {
  const extension = getExtension(file.name);
  const allowedMimeTypes = MIME_BY_EXTENSION[extension];

  if (!allowedMimeTypes) {
    return {
      valid: false,
      message: `Formato não permitido: ${file.name}.`,
    };
  }

  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      message: `O tipo MIME de ${file.name} não corresponde ao formato informado.`,
    };
  }

  if (file.size <= 0 || file.size > LEARNING_ATTACHMENT_MAX_BYTES) {
    return {
      valid: false,
      message: `${file.name} excede o limite de 25 MB.`,
    };
  }

  return { valid: true };
}

export function validateLearningAttachments(
  files: readonly File[],
): string | null {
  if (files.length > LEARNING_ATTACHMENT_MAX_COUNT) {
    return 'Você pode anexar no máximo 5 arquivos por publicação.';
  }

  for (const file of files) {
    const result = validateLearningAttachment(file);
    if (!result.valid) {
      return result.message ?? 'Um dos anexos é inválido.';
    }
  }

  return null;
}

import { describe, expect, it } from 'vitest';

import {
  LEARNING_ATTACHMENT_MAX_COUNT,
  LEARNING_ATTACHMENT_MAX_BYTES,
  sanitizeLearningFileName,
  validateLearningAttachment,
  validateLearningAttachments,
} from './learningContentValidation';

function file(name: string, type: string, size = 10): File {
  const value = new File(['content'], name, { type });
  Object.defineProperty(value, 'size', { configurable: true, value: size });
  return value;
}

describe('learning content attachment validation', () => {
  it('accepts an allowed extension only when its MIME type matches', () => {
    expect(validateLearningAttachment(file('lista.pdf', 'application/pdf')).valid).toBe(true);
    expect(validateLearningAttachment(file('lista.pdf', 'text/plain')).valid).toBe(false);
    expect(validateLearningAttachment(file('lista.exe', 'application/octet-stream')).valid).toBe(false);
  });

  it('rejects files over 25 MB and more than five files', () => {
    expect(validateLearningAttachment(file('video.pdf', 'application/pdf', LEARNING_ATTACHMENT_MAX_BYTES + 1)).valid).toBe(false);
    const files = Array.from({ length: LEARNING_ATTACHMENT_MAX_COUNT + 1 }, (_, index) =>
      file(`arquivo-${index}.txt`, 'text/plain'),
    );
    expect(validateLearningAttachments(files)).toContain('no máximo 5');
  });

  it('removes path traversal and unsafe characters from storage names', () => {
    expect(sanitizeLearningFileName('../Plano de aula (final).PDF')).toBe('Plano-de-aula-final.PDF');
  });
});

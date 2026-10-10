import { describe, expect, it } from 'vitest';

import { classifyCanonicalQuestion, classifyXequematTopic, validateSubjectClassificationRegistry } from './classification';

function question(overrides: Partial<Parameters<typeof classifyCanonicalQuestion>[0]> = {}) {
  return {
    canonicalId: 'q-1',
    year: 2025,
    day: 'D2',
    language: null,
    area: 'CIENCIAS_NATUREZA' as const,
    statement: 'A reação química libera energia e altera a temperatura da solução.',
    options: ['1', '2', '3', '4', '5'],
    officialAnswer: 'A' as const,
    qualityState: 'PARSED' as const,
    occurrences: [],
    ...overrides,
  };
}

describe('ENEM subject classification', () => {
  it('uses explicit Xequemat taxonomy topics for high-confidence subject promotion', () => {
    expect(classifyXequematTopic('CIENCIAS_HUMANAS', null, 'geografia-agraria')?.subject).toBe('GEOGRAFIA');
    expect(classifyXequematTopic('CIENCIAS_HUMANAS', null, 'filosofia-politica')?.subject).toBe('FILOSOFIA');
    expect(classifyXequematTopic('CIENCIAS_NATUREZA', null, 'estequiometria')?.subject).toBe('QUIMICA');
    expect(classifyXequematTopic('CIENCIAS_NATUREZA', null, 'ecologia-cadeias-e-teias-alimentares')?.subject).toBe('BIOLOGIA');
    expect(classifyXequematTopic('LINGUAGENS', null, 'interpretacao-de-texto')?.subject).toBe('LINGUA_PORTUGUESA');
    expect(classifyXequematTopic('CIENCIAS_HUMANAS', null, 'sociedade-colonial')?.subject).toBe('HISTORIA');
  });

  it('fails closed for unknown or ambiguous Xequemat topics', () => {
    expect(classifyXequematTopic('CIENCIAS_HUMANAS', null, 'humanidades')).toBeNull();
    expect(classifyXequematTopic('CIENCIAS_NATUREZA', null, '')).toBeNull();
    expect(classifyXequematTopic('LINGUAGENS', 'ENGLISH', 'interpretacao-de-texto')?.subject).toBe('INGLES');
  });

  it('classifies deterministic math and foreign-language occurrences', () => {
    expect(classifyCanonicalQuestion(question({ canonicalId: 'math', area: 'MATEMATICA' })).subject).toBe('MATEMATICA');
    expect(classifyCanonicalQuestion(question({ canonicalId: 'en', area: 'LINGUAGENS', language: 'ENGLISH' })).subject).toBe('INGLES');
    expect(classifyCanonicalQuestion(question({ canonicalId: 'es', area: 'LINGUAGENS', language: 'SPANISH' })).subject).toBe('ESPANHOL');
  });

  it('recognizes high-confidence historical references without an explicit subject label', () => {
    const result = classifyCanonicalQuestion(question({
      canonicalId: 'history',
      area: 'CIENCIAS_HUMANAS',
      statement: 'O Muro de Berlim e a Guerra Fria marcaram o século XX.',
    }));
    expect(result.subject).toBe('HISTORIA');
    expect(result.subject_verified).toBe(false);
    expect(result.review_state).toBe('CANDIDATE');
    expect(result.reason_code).toBe('CLASSIFICATION_CANDIDATE_HISTORIA');
  });

  it('does not verify a physics subject from keyword signals alone', () => {
    const result = classifyCanonicalQuestion(question({
      canonicalId: 'physics-candidate',
      statement: 'A mecânica analisa como a velocidade aumenta quando a força resultante atua sobre o corpo.',
    }));
    expect(result.subject).toBe('FISICA');
    expect(result.subject_verified).toBe(false);
    expect(result.review_state).toBe('CANDIDATE');
  });

  it('accepts a manually reviewed physics registry record', () => {
    const original = question({ canonicalId: 'physics-reviewed' });
    const automatic = classifyCanonicalQuestion(original);
    const reviewed = {
      ...automatic,
      subject: 'FISICA' as const,
      subject_verified: true,
      review_state: 'VERIFIED' as const,
      reason_code: 'VERIFIED_MANUAL_REVIEW',
    };
    expect(validateSubjectClassificationRegistry([reviewed], [original])).toEqual([]);
  });

  it('fails closed when signals do not disambiguate the subject', () => {
    const result = classifyCanonicalQuestion(question({ statement: 'Observe a situação apresentada e escolha a alternativa correta.' }));
    expect(result.subject).toBeNull();
    expect(result.subject_verified).toBe(false);
    expect(result.review_state).toBe('REVIEW_REQUIRED');
  });

  it('rejects a registry fingerprint or subject mismatch', () => {
    const original = question();
    const record = classifyCanonicalQuestion(original);
    expect(validateSubjectClassificationRegistry([{ ...record, source_fingerprint: 'x'.repeat(64) }], [original])).toContain(`FINGERPRINT_MISMATCH:${original.canonicalId}`);
    expect(validateSubjectClassificationRegistry([{ ...record, subject: 'HISTORIA', subject_verified: true, review_state: 'VERIFIED' }], [original])).toContain(`NATUREZA_SUBJECT_MISMATCH:${original.canonicalId}`);
  });

  it('rejects full question text from the frozen registry', () => {
    const original = question();
    const record = classifyCanonicalQuestion(original);
    expect(validateSubjectClassificationRegistry([{ ...record, statement: original.statement }], [original])).toContain(`INVALID_REGISTRY_FIELDS:${original.canonicalId}`);
  });
});

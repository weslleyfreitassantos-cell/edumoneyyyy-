import { describe, expect, it } from 'vitest';
import { buildXequematImportSql } from './import-xequemat';
import type { XequematArchiveReport } from './xequemat-archive';

describe('Xequemat import SQL', () => {
  it('persists source identity and keeps unresolved records inactive', () => {
    const report = {
      schemaVersion: 1,
      provider: 'xequemat',
      contentRevision: 'xequemat-archive-v1',
      source: { input: 'snapshot.zip', extractedRoot: null },
      rightsStatus: 'UNRESOLVED',
      scannedFiles: 1,
      parsedQuestions: 1,
      uniqueQuestions: 1,
      duplicateQuestions: 0,
      readyQuestions: 0,
      rejectedQuestions: 1,
      missingMediaReferences: 0,
      missingMediaQuestions: 0,
      byApplication: { REGULAR: 1 },
      byYear: { '2018': 1 },
      rejectionReasons: { RIGHTS_UNRESOLVED: 1 },
      records: [{
        provider: 'xequemat', contentRevision: 'xequemat-archive-v1', providerQuestionKey: 'REGULAR:2018:42:COMMON:hash',
        sourceFile: 'blog/questao-42-enem-2018/index.html', sourceUrl: 'https://xequematenem.com.br/blog/questao-42-enem-2018/',
        title: 'Questão 42 - ENEM 2018', year: 2018, questionNumber: 42, application: 'REGULAR', area: 'LINGUAGENS', subject: 'argumentacao', language: null, day: null,
        blocks: [{ kind: 'PARAGRAPH', text: 'Contexto' }, { kind: 'PARAGRAPH', text: 'Qual é a resposta?' }], contextText: 'Contexto', promptText: 'Qual é a resposta?',
        alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `Alternativa ${letter}`, blocks: [], media: [] })), correctAlternative: 'D', explanationText: null, media: [], normalizedContentHash: 'content', sourceHash: 'raw', completeStatement: true, completeAlternatives: true, answerPresent: true, requiredMediaPresent: true, rightsStatus: 'UNRESOLVED', ready: false, rejectionReasons: ['RIGHTS_UNRESOLVED'],
      }],
    } as XequematArchiveReport;
    const sql = buildXequematImportSql(report);
    expect(sql).toContain('source_question_number');
    expect(sql).toContain('source_application');
    expect(sql).toContain('content_blocks_json');
    expect(sql).toContain('rights_status');
    expect(sql).toContain(Buffer.from('enem_area').toString('hex'));
    expect(sql).toContain(Buffer.from('enem_subject').toString('hex'));
    expect(sql).toContain('554e5245534f4c564544');
    expect(sql).toContain(', false) returning id into v_question_id;');
  });

  it('splits large imports into bounded idempotent transactions', () => {
    const report = {
      schemaVersion: 1,
      provider: 'xequemat',
      contentRevision: 'xequemat-archive-v1',
      source: { input: 'snapshot.zip', extractedRoot: null },
      rightsStatus: 'VERIFIED',
      scannedFiles: 2,
      parsedQuestions: 2,
      uniqueQuestions: 2,
      duplicateQuestions: 0,
      readyQuestions: 2,
      rejectedQuestions: 0,
      missingMediaReferences: 0,
      missingMediaQuestions: 0,
      byApplication: { REGULAR: 2 },
      byYear: { '2018': 2 },
      rejectionReasons: {},
      records: Array.from({ length: 2 }, (_, index) => ({
        provider: 'xequemat', contentRevision: 'xequemat-archive-v1', providerQuestionKey: `REGULAR:2018:${index + 42}:COMMON:hash-${index}`,
        sourceFile: `blog/questao-${index + 42}-enem-2018/index.html`, sourceUrl: `https://xequematenem.com.br/blog/questao-${index + 42}-enem-2018/`,
        title: `Questão ${index + 42} - ENEM 2018`, year: 2018, questionNumber: index + 42, application: 'REGULAR', area: 'LINGUAGENS', subject: 'argumentacao', language: null, day: null,
        blocks: [{ kind: 'PARAGRAPH', text: 'Contexto' }, { kind: 'PARAGRAPH', text: 'Qual é a resposta?' }], contextText: 'Contexto', promptText: 'Qual é a resposta?',
        alternatives: ['A', 'B', 'C', 'D', 'E'].map((letter) => ({ letter, text: `Alternativa ${letter}`, blocks: [], media: [] })), correctAlternative: 'D', explanationText: null, media: [], normalizedContentHash: `content-${index}`, sourceHash: `raw-${index}`, completeStatement: true, completeAlternatives: true, answerPresent: true,
        requiredMediaPresent: false, rightsStatus: 'VERIFIED', ready: true, rejectionReasons: [],
      })),
    } as XequematArchiveReport;
    const sql = buildXequematImportSql(report, { batchSize: 1 });
    expect((sql.match(/\bbegin;/gu) ?? []).length).toBe(2);
    expect((sql.match(/\bcommit;/gu) ?? []).length).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';

import { extractQuestionSegments, parseOfficialAnswerKey, parseQuestionSegments } from './parse';

describe('ENEM official PDF parser', () => {
  it('parses D1 answer keys including both foreign-language variants', () => {
    const text = 'QUESTÃO GABARITO 46 E 47 D 90 A CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS QUESTÃO GABARITO INGLÊS ESPANHOL 1 D B 2 D A 3 D D 4 E D 5 A C 6 E 45 C LINGUAGENS';
    expect(parseOfficialAnswerKey(text, 'D1')).toEqual(expect.arrayContaining([
      { questionNumber: 1, language: 'ENGLISH', answer: 'D' },
      { questionNumber: 1, language: 'SPANISH', answer: 'B' },
      { questionNumber: 46, language: null, answer: 'E' },
      { questionNumber: 90, language: null, answer: 'A' },
    ]));
    expect(parseOfficialAnswerKey(text, 'D1')).toHaveLength(15);
  });

  it('preserves ANULADO as an official non-answer state', () => {
    const text = 'CADERNO 5 QUESTÃO GABARITO 91 C 92 Anulado 93 D 180 C';
    expect(parseOfficialAnswerKey(text, 'D2')).toEqual([
      { questionNumber: 91, language: null, answer: 'C' },
      { questionNumber: 92, language: null, answer: 'ANNULLED' },
      { questionNumber: 93, language: null, answer: 'D' },
      { questionNumber: 180, language: null, answer: 'C' },
    ]);
  });

  it('extracts question boundaries and marks media-bearing items for review', () => {
    const segments = extractQuestionSegments([
      { page: 2, text: 'Questões de 01 a 05 (opção inglês) Q UEST ã O 01 Texto de apoio. Qual é a resposta? A Uma B Duas C Três D Quatro E Cinco' },
      { page: 3, text: 'Q UEST ã O 02 A figura apresenta um mapa. Qual é a resposta? A Uma B Duas C Três D Quatro E Cinco' },
    ], 'D1');
    const questions = parseQuestionSegments(segments, [
      { questionNumber: 1, language: 'ENGLISH', answer: 'A' },
      { questionNumber: 2, language: 'ENGLISH', answer: 'B' },
    ]);
    expect(questions[0]).toMatchObject({ questionNumber: 1, language: 'ENGLISH', officialAnswer: 'A', options: ['Uma', 'Duas', 'Três', 'Quatro', 'Cinco'], qualityState: 'PARSED' });
    expect(questions[1]).toMatchObject({ questionNumber: 2, mediaStatus: 'REVIEW_REQUIRED', qualityState: 'REVIEW_REQUIRED' });
    expect(questions[1].reviewReasons).toContain('MEDIA_REQUIRED');
  });

  it('records structural reasons without pretending they are pedagogical review', () => {
    const [question] = parseQuestionSegments([
      { questionNumber: 10, language: null, page: 4, area: 'MATEMATICA', raw: 'curto A Uma B Duas' },
    ], []);
    expect(question.qualityState).toBe('REVIEW_REQUIRED');
    expect(question.reviewReasons).toEqual(expect.arrayContaining(['MISSING_OPTIONS', 'STATEMENT_TOO_SHORT', 'UNKNOWN_OFFICIAL_ANSWER']));
  });
});

import { describe, expect, it } from 'vitest';

import { recoverOptionsFromGeometry, runSecondPass } from './second-pass';
import type { PdfGeometryPage } from './geometry';
import type { EnemParseResult } from './parse';

describe('ENEM geometric second pass', () => {
  it('recovers split A-E labels from one PDF baseline', () => {
    const page: PdfGeometryPage = {
      page: 4,
      width: 600,
      height: 800,
      items: [
        { text: 'Q', x: 60, y: 700, width: 8, height: 10, fontSize: 10 },
        { text: 'UEST', x: 68, y: 700, width: 30, height: 10, fontSize: 10 },
        { text: 'ã', x: 98, y: 700, width: 8, height: 10, fontSize: 10 },
        { text: 'O', x: 106, y: 700, width: 8, height: 10, fontSize: 10 },
        { text: '03', x: 114, y: 700, width: 12, height: 10, fontSize: 10 },
        ...(['A', 'B', 'C', 'D', 'E'] as const).flatMap((label, index) => [
          { text: label, x: 60, y: 640 - index * 20, width: 5, height: 10, fontSize: 10 },
          { text: `Opção ${label}`, x: 78, y: 640 - index * 20, width: 40, height: 10, fontSize: 10 },
        ]),
      ],
    };
    expect(recoverOptionsFromGeometry([page], 3)).toMatchObject({
      status: 'RECOVERED',
      options: ['Opção A', 'Opção B', 'Opção C', 'Opção D', 'Opção E'],
    });
  });

  it('keeps structural quarantine when the source cannot be recovered', async () => {
    const parsed: EnemParseResult = {
      schemaVersion: 1,
      parsedAt: new Date(0).toISOString(),
      issues: [],
      artifacts: [{
        year: 2025,
        day: 'D1',
        booklet: 'CD1',
        examPath: 'missing.pdf',
        answerKeyPath: 'missing-key.pdf',
        answerKey: [],
        issues: [],
        qualityState: 'REVIEW_REQUIRED',
        questions: [{
          questionNumber: 1,
          language: 'ENGLISH',
          page: 1,
          area: 'LINGUAGENS',
          statement: 'Question',
          supportText: null,
          options: [],
          officialAnswer: 'A',
          mediaStatus: 'NOT_DETECTED',
          qualityState: 'REVIEW_REQUIRED',
          reviewReasons: ['MISSING_OPTIONS'],
        }],
      }],
    };
    await expect(runSecondPass(parsed)).rejects.toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { buildEnemVisualIntegrityReport } from './visual-integrity-report';
import type { EnemParseResult } from './parse';
import type { EnemAssetRenderManifest } from './render-question-assets';

function question(
  questionNumber: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    questionNumber,
    language: null,
    renderReady: false,
    sourceIntegrity: 'VERIFIED' as const,
    statementIntegrity: 'VERIFIED' as const,
    optionsIntegrity: 'VERIFIED' as const,
    validation: 'VERIFIED' as const,
    excludedOptionLabels: ['A', 'B', 'C', 'D', 'E'],
    planReason: null,
    statementAssets: [],
    optionAssets: { A: [], B: [], C: [], D: [], E: [] },
    renderMode: 'TEXT_OPTIONS' as const,
    statementContainsOptions: false,
    sourceColumn: 'FULL' as const,
    ...overrides,
  };
}

function optionAsset(label: 'A' | 'B' | 'C' | 'D' | 'E') {
  return {
    assetRole: `OPTION_${label}` as const,
    mediaType: 'OPTION_CROP' as const,
    optionLabel: label,
    questionNumber: 1,
    language: null,
    page: 1,
    storagePath: `option-${label}.png`,
    sha256: 'hash',
    crop: { left: 0, bottom: 0, width: 10, height: 10 },
  };
}

describe('ENEM visual integrity report', () => {
  it('separates validated text, image, mixed and unresolved option sets', () => {
    const parsed = {
      artifacts: [{
        year: 2025,
        day: 'D1',
        booklet: 'CD1',
        examPath: 'exam.pdf',
        questions: [
          { questionNumber: 1, language: null, options: ['Texto A', 'Texto B', 'Texto C', 'Texto D', 'Texto E'] },
          { questionNumber: 2, language: null, options: [] },
          { questionNumber: 3, language: null, options: ['Texto A', 'Texto B', 'Texto C', 'Texto D', 'Texto E'] },
          { questionNumber: 4, language: null, options: ['Texto A', 'Texto B', 'Texto C', 'Texto D', 'Texto E'] },
        ],
      }],
    } as unknown as EnemParseResult;
    const visualAssets = Object.fromEntries(
      (['A', 'B', 'C', 'D', 'E'] as const).map((label) => [label, [optionAsset(label)]]),
    );
    const assets = {
      artifacts: [{
        artifactKey: '2025-D1-CD1',
        year: 2025,
        day: 'D1',
        booklet: 'CD1',
        examPath: 'exam.pdf',
        schemaVersion: 2,
        generatedAt: '2026-01-01T00:00:00.000Z',
        questions: [
          question(1),
          question(2, { renderReady: true, renderMode: 'VISUAL_OPTIONS', optionAssets: visualAssets }),
          question(3, { renderReady: true, renderMode: 'VISUAL_OPTIONS', optionAssets: visualAssets }),
          question(4, { optionsIntegrity: 'REVIEW_REQUIRED', planReason: 'OPTION_REGIONS_NOT_CONFIRMED' }),
        ],
      }],
    } as unknown as { artifacts: EnemAssetRenderManifest[] };

    const report = buildEnemVisualIntegrityReport(parsed, assets);

    expect(report.categories.TEXT_ONLY_OPTIONS).toBe(1);
    expect(report.categories.IMAGE_OPTIONS).toBe(1);
    expect(report.categories.MIXED_TEXT_IMAGE_OPTIONS).toBe(1);
    expect(report.categories.OTHER_COMPLEX).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc },
}));

import {
  CURRENT_ENEM_CONTENT_REVISION,
  learningCenterService,
  SUPPORTED_ENEM_CONTENT_REVISIONS,
} from './learningCenterService';

describe('learningCenterService ENEM visual options', () => {
  beforeEach(() => rpc.mockReset());

  it('keeps the frontend revision aligned with the published archive pool while preserving history', () => {
    expect(CURRENT_ENEM_CONTENT_REVISION).toBe('xequemat-archive-v1');
    expect(SUPPORTED_ENEM_CONTENT_REVISIONS).toEqual(
      new Set([
        'xequemat-archive-v1',
        'structured-text-only-v6',
        'structured-text-only-v5',
        'structured-text-only-v4',
        'structured-text-v1',
        'source-faithful-v3',
      ]),
    );
  });

  it('recovers visual options from metadata when the legacy RPC returns strings', async () => {
    rpc.mockResolvedValue({
      data: {
        attempt_id: 'attempt-1',
        simulation_id: 'simulation-1',
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: null,
        total_questions: 1,
        score: 0,
        correct_count: 0,
        answers: {},
        navigation_state: null,
        questions: [{
          position: 1,
          question_bank_id: 'question-1',
          statement: 'Questão oficial',
          options: ['texto corrompido\u0003', 'B', 'C', 'D', 'E'],
          source_year: 2021,
          question_number: 133,
          metadata: {
            option_assets: {
              A: [{ mediaType: 'OPTION_CROP', storagePath: 'v2/q133/option-A.png' }],
            },
          },
          statement_assets: [],
        }],
      },
      error: null,
    });

    const attempt = await learningCenterService.getEnemSimulationAttempt('attempt-1');
    const [first, second] = attempt.questions[0].options as Array<{ text: string | null; assets: Array<{ storage_path: string | null }> }>;

    expect(first.text).toBeNull();
    expect(first.assets[0].storage_path).toBe('v2/q133/option-A.png');
    expect(second.text).toBe('B');
    expect(rpc).toHaveBeenCalledWith('get_enem_simulation_attempt_v2', { p_attempt_id: 'attempt-1' });
  });

  it('does not restore legacy PDF crops over verified text-only English content', async () => {
    const optionAssets = Object.fromEntries(
      ['A', 'B', 'C', 'D', 'E'].map((letter) => [letter, [{
        mediaType: 'OPTION_CROP',
        storagePath: `legacy/option-${letter}.png`,
      }]]),
    );
    const textOptions = ['mudança de comportamento.', 'panorama de conflitos.', 'rotina de isolamento.', 'perspectiva bélica.', 'cenário religioso.'];
    rpc.mockResolvedValue({
      data: {
        attempt_id: 'attempt-1',
        simulation_id: 'simulation-1',
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_seconds: null,
        total_questions: 1,
        score: 0,
        correct_count: 0,
        answers: {},
        navigation_state: null,
        simulation: { id: 'simulation-1', metadata: { enem_subject: 'INGLES' } },
        questions: [{
          position: 1,
          question_bank_id: 'question-2024-english-1',
          statement: 'Enunciado oficial transcrito.',
          options: textOptions.map((text, index) => ({
            label: String.fromCharCode(65 + index),
            text,
            assets: [],
          })),
          structured_content: {
            context: 'Enunciado oficial transcrito.',
            prompt: '',
            alternatives: [],
            render_mode: 'STRUCTURED_TEXT',
            essential_media: [],
          },
          metadata: {
            statement_assets: [{ mediaType: 'STATEMENT_CROP', storagePath: 'legacy/statement.png' }],
            option_assets: optionAssets,
          },
          statement_assets: [],
        }],
      },
      error: null,
    });

    const attempt = await learningCenterService.getEnemSimulationAttempt('attempt-1');
    const question = attempt.questions[0];

    expect(question.statement_assets).toEqual([]);
    expect(question.options.map((option) => typeof option === 'string' ? option : option.text)).toEqual(textOptions);
    expect(question.options.every((option) => typeof option === 'string' || option.assets.length === 0)).toBe(true);
  });
});

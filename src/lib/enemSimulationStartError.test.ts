import { describe, expect, it } from 'vitest';

import { describeEnemSimulationStartError } from './enemSimulationStartError';

describe('ENEM simulation start errors', () => {
  it('explains when the selected language has no sufficiently large approved pool', () => {
    const failure = describeEnemSimulationStartError(
      new Error('ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT'),
    );

    expect(failure.diagnosticCode).toBe('ENEM_PROVIDER_TEXT_POOL_INSUFFICIENT');
    expect(failure.message).toMatch(/questões oficiais aprovadas suficientes/i);
    expect(failure.message).toMatch(/idioma/i);
  });

  it('explains when the active student enrollment cannot be verified', () => {
    const failure = describeEnemSimulationStartError(
      new Error('LEARNING_STUDENT_SCOPE_DENIED'),
    );

    expect(failure.message).toMatch(/matrícula ativa/i);
    expect(failure.diagnosticCode).toBe('LEARNING_STUDENT_SCOPE_DENIED');
  });

  it('keeps unknown safe server codes visible without exposing arbitrary messages', () => {
    const failure = describeEnemSimulationStartError(
      new Error('ENEM_UNEXPECTED_INTERNAL_FAILURE: private detail'),
    );

    expect(failure.diagnosticCode).toBe('ENEM_UNEXPECTED_INTERNAL_FAILURE');
    expect(failure.message).toContain('ENEM_UNEXPECTED_INTERNAL_FAILURE');
    expect(failure.message).not.toContain('private detail');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildApplicationUrl,
  getApplicationOrigin,
  MARKETING_ORIGIN,
  PLATFORM_APP_ORIGIN,
} from './origins';

describe('application origins', () => {
  it('centraliza as origens de marketing e plataforma', () => {
    expect(MARKETING_ORIGIN).toBe('https://grupotec.dev.br');
    expect(PLATFORM_APP_ORIGIN).toBe('https://tecescola.grupotec.dev.br');
  });

  it('usa TecEscola quando não há origem específica', () => {
    expect(getApplicationOrigin()).toBe(PLATFORM_APP_ORIGIN);
    expect(getApplicationOrigin('https://grupotec.dev.br')).toBe(
      PLATFORM_APP_ORIGIN,
    );
  });

  it('preserva a origem do tenant institucional', () => {
    expect(
      getApplicationOrigin('https://escola-luz.grupotec.dev.br'),
    ).toBe('https://escola-luz.grupotec.dev.br');
  });

  it('preserva origens locais e de preview', () => {
    expect(getApplicationOrigin('http://localhost:3000')).toBe(
      'http://localhost:3000',
    );
    expect(getApplicationOrigin('https://edumoneyyyy.workers.dev')).toBe(
      'https://edumoneyyyy.workers.dev',
    );
  });

  it('monta o caminho na origem de aplicação correta', () => {
    expect(buildApplicationUrl('/auth/reset-password')).toBe(
      `${PLATFORM_APP_ORIGIN}/auth/reset-password`,
    );
    expect(
      buildApplicationUrl('login?institution=escola-luz', 'https://grupotec.dev.br'),
    ).toBe(`${PLATFORM_APP_ORIGIN}/login?institution=escola-luz`);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20260930000300_adaptive_learning_starter_packages_v1.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning starter packages migration', () => {
  it('creates the seven deterministic TecEscola starter packages', () => {
    for (const title of [
      'Fundamentos de Frações',
      'Razão e Proporção',
      'Porcentagem',
      'Equações',
      'Introdução a Funções',
      'Função Afim',
      'Preparação Matemática ENEM — Fundamentos',
    ]) {
      expect(migration).toContain(title);
    }
    expect(migration).toContain("package_type = 'TECESCOLA'");
    expect(migration).toContain("visibility = 'GLOBAL'");
    expect(migration).toContain("'starter_package', true");
  });

  it('reuses canonical lessons instead of inventing package content', () => {
    expect(migration).toContain("catalog.code = 'TECESCOLA_CORE'");
    expect(migration).toContain('learning_skill_lessons');
    expect(migration).toContain("'official_content_imported', false");
    expect(migration).toContain('on conflict (package_id, position) do update');
  });
});

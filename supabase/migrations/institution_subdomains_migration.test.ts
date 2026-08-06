import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Institution Subdomains Migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260806000100_institution_subdomains.sql',
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  it('adiciona a coluna subdomain e suas constraints na tabela institutions', () => {
    expect(migrationSql).toMatch(/add column if not exists subdomain text/i);
    expect(migrationSql).toMatch(/institutions_subdomain_format_check/i);
    expect(migrationSql).toMatch(/institutions_subdomain_idx/i);
    expect(migrationSql).toMatch(/grant update \(subdomain\)/i);
  });
});

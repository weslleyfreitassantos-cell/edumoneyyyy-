import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const previousMigration = readFileSync(
  new URL('./20261010000100_complete_subject_practices_and_bncc_guided_learning_v1.sql', import.meta.url),
  'utf8',
);
const startMigration = readFileSync(
  new URL('./20261008000600_enem_provider_text_only_v4.sql', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('./20261015000100_enem_provider_pool_random_sort_timeout_fix.sql', import.meta.url),
  'utf8',
);

function extractReadyPool(source: string): string {
  return source.match(
    /create or replace function private\.enem_ready_provider_text_questions\([\s\S]*?\$\$;/i,
  )?.[0] ?? '';
}

describe('ENEM provider pool timeout fix', () => {
  it('preserves eligibility rules and removes only the helper-level random sort', () => {
    const previousPool = extractReadyPool(previousMigration).replace(/\r\n/g, '\n');
    const updatedPool = extractReadyPool(migration).replace(/\r\n/g, '\n');

    expect(previousPool).not.toBe('');
    expect(updatedPool).toBe(
      previousPool.replace(/\n  order by random\(\);/i, ';'),
    );
    expect(updatedPool).not.toMatch(/order\s+by\s+random/i);
  });

  it('keeps randomized question selection in the existing start RPC and service-role-only helper access', () => {
    expect(startMigration).toMatch(/order by random\(\) limit requested_count/i);
    expect(migration).toContain(
      'revoke all on function private.enem_ready_provider_text_questions(text, text, text)',
    );
    expect(migration).toContain(
      'grant execute on function private.enem_ready_provider_text_questions(text, text, text)\n  to service_role',
    );
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+(into\s+)?public\./i);
  });
});

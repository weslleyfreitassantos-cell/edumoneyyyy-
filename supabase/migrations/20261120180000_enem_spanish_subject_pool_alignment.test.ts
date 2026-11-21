import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261120180000_enem_spanish_subject_pool_alignment.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('ENEM Spanish subject pool alignment', () => {
  it('does not apply the simulation area filter to subject-specific Spanish practice', () => {
    expect(migration).toMatch(
      /p_area is null\s+or upper\(coalesce\(p_subject, ''\)\) = 'ESPANHOL'\s+or question_bank\.subject_area = p_area/i,
    );
    expect(migration).toMatch(/p_subject is null[\s\S]*?upper\(p_subject\)/i);
    expect(migration).toMatch(/p_language is not null and structured\.language = upper\(p_language\)/i);
  });

  it('preserves the service-role-only grant on the shared pool helper', () => {
    expect(migration).toContain(
      'revoke all on function private.enem_ready_provider_text_questions(text, text, text)',
    );
    expect(migration).toContain(
      'grant execute on function private.enem_ready_provider_text_questions(text, text, text)\n  to service_role',
    );
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+(into\s+)?public\./i);
  });
});

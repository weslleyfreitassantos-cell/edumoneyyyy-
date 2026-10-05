import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261005000200_student_self_registration_confirmation.sql', import.meta.url),
  'utf8',
);

describe('student self registration confirmation migration', () => {
  it('persists the one-time confirmation and exposes it through the self-service contract', () => {
    expect(migration).toContain('add column if not exists self_registration_confirmed_at timestamptz');
    expect(migration).toContain("'self_registration_confirmed', v_student.self_registration_confirmed_at is not null");
    expect(migration).toContain("p_payload->>'confirm_protected_data'");
    expect(migration).toContain('self_registration_confirmed_at = case');
  });

  it('enforces canonical validation and blocks protected changes after confirmation', () => {
    expect(migration).toContain('private.normalize_self_registration_digits');
    expect(migration).toContain("message = 'CPF invalido.'");
    expect(migration).toContain("message = 'Seus dados cadastrais ja foram confirmados.");
    expect(migration).toContain('v_current_protected is distinct from v_requested_protected');
    expect(migration).toContain('for update;');
  });

  it('keeps the existing administrative correction path separate and does not deploy anything', () => {
    expect(migration).not.toContain('update_full_student_enrollment_bundle');
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('db push');
    expect(migration).not.toContain('functions deploy');
  });
});

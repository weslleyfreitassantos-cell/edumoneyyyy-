import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261012000300_enem_template_timeout_hotfix_v1.sql', import.meta.url),
  'utf8',
);

describe('ENEM template RPC timeout hotfix', () => {
  it('materializes one shared eligible English scan without changing its filters or output', () => {
    expect(migration).toContain('with ready_questions as materialized');
    expect(migration.match(/private\.enem_ready_questions\(null, 'INGLES', 'ENGLISH'\)/g)).toHaveLength(1);
    expect(migration).toContain('from ready_questions ready');
    expect(migration).toContain("ready.source_kind = 'STRUCTURED_PROVIDER'");
    expect(migration).toContain("ready.source_kind = 'OFFICIAL_OCCURRENCE'");
    expect(migration).toContain("structured.rights_status = 'VERIFIED'");
    expect(migration).toContain("statement_asset.quality_state = 'VALIDATED'");
    expect(migration).toContain("count(distinct option_asset.metadata->>'option_label')");
    expect(migration).toContain('earlier.source_identity = candidate.source_identity');
    expect(migration).toContain('order by candidate.question_id');
  });

  it('keeps the helper private and read-only', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('revoke all on function private.enem_ready_english_practice_questions_v1() from public, anon, authenticated');
    expect(migration).toContain('grant execute on function private.enem_ready_english_practice_questions_v1() to service_role');
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+(into\s+)?public\./i);
    expect(migration).not.toMatch(/disable row level security|migration repair/i);
  });
});

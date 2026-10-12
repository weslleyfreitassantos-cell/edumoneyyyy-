import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const previousMigration = readFileSync(
  new URL('./20261012000200_enem_english_multimodal_full_practice_v1.sql', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('./20261012000400_enem_template_counts_materialized_v1.sql', import.meta.url),
  'utf8',
);

function extractTemplateRpc(source: string): string {
  return source.match(/create or replace function public\.list_enem_simulation_templates_v2\(p_institution_id uuid\)[\s\S]*?\$\$;/i)?.[0] ?? '';
}

describe('ENEM template pool-count materialization', () => {
  it('changes only the counts CTE materialization while keeping RPC behavior identical', () => {
    const previousRpc = extractTemplateRpc(previousMigration);
    const updatedRpc = extractTemplateRpc(migration);

    expect(previousRpc).not.toBe('');
    expect(updatedRpc).toBe(previousRpc.replace('), counts as (', '), counts as materialized ('));
    expect(updatedRpc).toContain('private.enem_ready_english_practice_questions_v1()');
    expect(updatedRpc).toContain("counts.pool_count > 0 and counts.pool_count < counts.question_count");
  });

  it('preserves authenticated-only RPC execution and does not write attempt history', () => {
    expect(migration).toContain('revoke all on function public.list_enem_simulation_templates_v2(uuid) from public, anon');
    expect(migration).toContain('grant execute on function public.list_enem_simulation_templates_v2(uuid) to authenticated');
    expect(migration).not.toMatch(/\b(insert|update|delete|truncate)\s+(into\s+)?public\./i);
    expect(migration).not.toMatch(/disable row level security|migration repair/i);
  });
});

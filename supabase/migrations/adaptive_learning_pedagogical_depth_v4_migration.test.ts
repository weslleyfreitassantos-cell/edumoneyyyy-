import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261001000100_adaptive_learning_pedagogical_depth_v4.sql', import.meta.url),
  'utf8',
);

describe('adaptive learning pedagogical depth v4 migration', () => {
  it('adds explicit node, readiness, review and hierarchy contracts', () => {
    expect(migration).toContain('node_kind');
    expect(migration).toContain("content_readiness in ('GRAPH_ONLY', 'CONTENT_READY', 'ADAPTIVE_READY')");
    expect(migration).toContain('mastery_targetable');
    expect(migration).toContain('learning_skill_hierarchy');
    expect(migration).toContain('learning_adaptive_content_packs');
  });

  it('keeps generated content tied to the existing canonical catalog', () => {
    expect(migration).toContain("code = 'TECESCOLA_CORE' and version = '1.0'");
    expect(migration).toContain("'TECESCOLA_CORE_V4'");
    expect(migration).toContain('V4_CONTENT_HASH=');
    expect(migration).toContain('PEDAGOGICAL_REVIEW_PENDING');
    expect(migration).not.toContain('drop table');
    expect(migration).not.toContain('truncate ');
  });

  it('exposes an isolated V4 guided-journey contract with a V2 fallback path', () => {
    expect(migration).toContain('start_guided_learning_session_v4');
    expect(migration).toContain('get_guided_learning_session_v4');
    expect(migration).toContain('get_guided_learning_step_v4');
    expect(migration).toContain('advance_guided_learning_session_v4');
    expect(migration).toContain('submit_guided_learning_step_v4');
    expect(migration).toContain("planner_version = 'V4'");
    expect(migration).toContain("content_readiness = 'ADAPTIVE_READY'");
    expect(migration).toContain('grant execute on function public.start_guided_learning_session_v4');
  });

  it('uses scoped PL/pgSQL variables instead of ambiguous column names', () => {
    expect(migration).toContain('v_catalog_id');
    expect(migration).toContain('v_skill_id');
    expect(migration).toContain('canonical.catalog_id = v_catalog_id');
    expect(migration).not.toMatch(/where catalog_id = catalog_id/);
    expect(migration).not.toMatch(/values \(catalog_id,/);
  });

  it('is safe to regenerate constraints and policies without touching production', () => {
    expect(migration).toContain('if not exists (select 1 from pg_constraint');
    expect(migration).toContain('drop policy if exists learning_skill_hierarchy_select');
    expect(migration).toContain('revoke all on public.learning_skill_hierarchy, public.learning_adaptive_content_packs from anon');
  });
});

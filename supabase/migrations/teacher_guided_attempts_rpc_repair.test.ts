import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
const original = read('./20261022000100_teacher_learning_guided_performance.sql');
const repair = read('./20261120163512_repair_teacher_guided_attempts_rpc.sql');
describe('teacher guided attempts RPC repair', () => {
  it('copies the existing tenant-scoped canonical RPC body', () => {
    const start = original.indexOf('create or replace function public.get_teacher_guided_learning_attempts(');
    const end = original.indexOf('\n$$;', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const originalDef = original.slice(start,end+4)
      .replace('create or replace function', 'create function')
      .replace('as $$', 'as $rpc_body$')
      .replace(/\$\$;$/, '$rpc_body$;');
    expect(repair).toContain(originalDef);
    expect(originalDef).toContain('private.learning_teacher_can_access_subject_scope');
  });
  it('does not overwrite existing RPC and grants authenticated-only execution', () => {
    expect(repair).toContain("to_regprocedure('public.get_teacher_guided_learning_attempts(uuid,uuid,uuid,uuid)') is null");
    expect(repair).toMatch(/revoke all on function[\s\S]+from public, anon;/);
    expect(repair).toMatch(/grant execute on function[\s\S]+to authenticated;/);
    expect(repair).toContain('security definer');
    expect(repair).toContain("set search_path = ''");
  });
});

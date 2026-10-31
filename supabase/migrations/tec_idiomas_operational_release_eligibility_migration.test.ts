import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('./20261031000100_tec_english_operational_release_eligibility.sql', import.meta.url),
  'utf8',
);

function functionBody(name: string): string {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `migration defines ${name}`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf('\ncreate or replace function ', start + 1);
  return sql.slice(start, next < 0 ? undefined : next);
}

describe('Tec Idiomas operational institutional-release eligibility migration', () => {
  it('requires an active institution, ACTIVE account, official operational status, and no suspension or test markers', () => {
    const helper = functionBody('private.tec_english_institution_release_eligible');
    expect(helper).toMatch(/join public\.accounts account\s+on account\.id = institution\.account_id/i);
    expect(helper).toMatch(/institution\.active is true/i);
    expect(helper).toMatch(/institution\.suspended_at is null/i);
    expect(helper).toMatch(/account\.status = 'ACTIVE'/i);
    expect(helper).toMatch(/public\.is_institution_operational\(institution\.id\)/i);
    expect(helper).toMatch(/qa\|test\|tests\|teste\|testes\|synthetic\|sandbox\|demo\|pilot\|preview\|staging/i);
    expect(helper).toMatch(/strpos\([\s\S]*'homolog'[\s\S]*\) = 0/i);
    expect(sql).toMatch(/revoke all on function private\.tec_english_institution_release_eligible\(uuid\)\s+from public, anon, authenticated, service_role/i);
  });

  it('uses the eligibility helper both when listing targets and when deciding student access', () => {
    const targets = functionBody('public.get_tec_english_release_targets_v1');
    const availability = functionBody('private.tec_english_course_available');
    expect(targets).toMatch(/public\.is_platform_super_admin\(\)/i);
    expect(targets).toMatch(/private\.tec_english_institution_release_eligible\(item\.id\)/i);
    expect(targets).toMatch(/'operational_status', institution\.account_status/i);
    expect(targets).not.toMatch(/'available_courses'\s*,\s*8/i);
    expect(availability).toMatch(/private\.tec_english_institution_release_eligible\(institution\.id\)/i);
  });

  it('retains the Super Admin gate, revalidates enable requests, and permits audited revocation of historical releases', () => {
    const setter = functionBody('public.set_tec_english_institution_release_v1');
    expect(setter).toMatch(/public\.is_platform_super_admin\(\)/i);
    expect(setter).toMatch(/if p_enabled and not private\.tec_english_institution_release_eligible\(p_institution_id\)/i);
    expect(setter).toMatch(/pg_advisory_xact_lock/i);
    expect(setter).toMatch(/if not found and not p_enabled[\s\S]*'changed', false/i);
    expect(setter).toMatch(/if found and v_existing_enabled = p_enabled[\s\S]*'changed', false/i);
    expect(setter).toMatch(/insert into public\.tec_english_course_release_events/i);
    expect(setter).toMatch(/v_action := case when p_enabled then 'ENABLED' else 'DISABLED' end/i);
    expect(setter).not.toMatch(/if not private\.tec_english_institution_release_eligible\(p_institution_id\) then/i);
  });

  it('keeps RPC execution limited to authenticated callers; the functions enforce Super Admin in the backend', () => {
    expect(sql).toMatch(/revoke all on function public\.get_tec_english_release_targets_v1\(text, integer, text\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.get_tec_english_release_targets_v1\(text, integer, text\) to authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.set_tec_english_institution_release_v1\(text, integer, uuid, boolean\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.set_tec_english_institution_release_v1\(text, integer, uuid, boolean\) to authenticated/i);
  });
});

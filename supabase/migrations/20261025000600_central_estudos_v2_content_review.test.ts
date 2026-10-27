import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationDir = dirname(fileURLToPath(import.meta.url));

describe('Central de Estudos V2 content review migration', () => {
  it('seeds every candidate as private staging content and retains its fingerprint', async () => {
    const [migration, docket] = await Promise.all([
      readFile(join(migrationDir, '20261025000600_central_estudos_v2_content_review.sql'), 'utf8'),
      readFile(join(migrationDir, '../../content/adaptive/central-estudos-v2/review-docket.json'), 'utf8').then(JSON.parse),
    ]);

    expect(docket.items).toHaveLength(9);
    for (const item of docket.items) {
      expect(migration).toContain(item.candidate);
      expect(migration).toContain(item.contentSha256);
    }
    expect(migration.match(/\('CEV2_/g)).toHaveLength(9);
    expect(migration).toContain("default 'PEDAGOGICAL_REVIEW_PENDING'");
    expect(migration).toContain("default 'STAGING'");
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.learning_central_studies_v2_candidates');
  });

  it('checks Super Admin authorization, exact content fingerprints and complete human approval criteria', async () => {
    const migration = await readFile(join(migrationDir, '20261025000600_central_estudos_v2_content_review.sql'), 'utf8');
    expect(migration.match(/if not public\.is_platform_super_admin\(\) then/g)).toHaveLength(3);
    expect(migration).toContain('CENTRAL_STUDIES_V2_CONTENT_CHANGED');
    expect(migration).toContain('CENTRAL_STUDIES_V2_REVIEW_CHECKLIST_INCOMPLETE');
    expect(migration).toContain('CENTRAL_STUDIES_V2_APPROVED_VERSION_IMMUTABLE');
    expect(migration).toContain("publication_status = 'STAGING'");
    expect(migration).toContain('Append-only audit history');
    expect(migration).toContain('grant execute on function public.review_central_studies_v2_candidate_v1');
  });
});

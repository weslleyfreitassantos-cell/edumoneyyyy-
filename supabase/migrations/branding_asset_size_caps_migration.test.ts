import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    './20261007000100_remove_branding_asset_size_caps.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('branding asset size cap removal migration', () => {
  it('keeps format and access validation without favicon/background caps', () => {
    expect(migration).toContain('is_valid_branding_storage_metadata');
    expect(migration).toContain(
      'can_director_write_institution_branding_object',
    );
    expect(migration).toContain("'image/png'");
    expect(migration).toContain("'image/jpeg'");
    expect(migration).toContain("'image/webp'");
    expect(migration).toContain("role = 'DIRECTOR'");
    expect(migration).toContain('(logo|favicon|background)');
    expect(migration).not.toContain('512 * 1024');
    expect(migration).not.toContain('5 * 1024 * 1024');
    expect(migration).not.toContain('metadata_size >');
  });

  it('recria as políticas de escrita do editor institucional', () => {
    expect(migration).toContain('institution_branding_director_insert');
    expect(migration).toContain('institution_branding_director_update');
    expect(migration).toContain('institution_branding_director_delete');
    expect(migration).toContain("bucket_id = 'institution-branding'");
  });
});

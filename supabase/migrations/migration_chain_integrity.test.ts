import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = path.join(
  process.cwd(),
  'supabase',
  'migrations',
);

const sqlMigrationFiles = fs
  .readdirSync(migrationsDirectory)
  .filter((fileName) => fileName.endsWith('.sql'));

describe('migration chain integrity', () => {
  it('does not allow UTF-8 BOM in SQL migrations', () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);

    for (const fileName of sqlMigrationFiles) {
      const migration = fs.readFileSync(
        path.join(migrationsDirectory, fileName),
      );

      expect(migration.subarray(0, bom.length)).not.toEqual(bom);
    }
  });

  it('keeps one active advisor performance hardening migration', () => {
    const advisorMigrations = sqlMigrationFiles.filter((fileName) =>
      fileName.includes('advisor_performance_hardening'),
    );

    expect(advisorMigrations).toEqual([
      '20260906222415_advisor_performance_hardening.sql',
    ]);
  });

  it('does not reuse migration timestamps', () => {
    const versions = sqlMigrationFiles.map((fileName) => {
      const match = fileName.match(/^(\d{14})_/);
      expect(match).not.toBeNull();
      return match?.[1];
    });

    expect(new Set(versions).size).toBe(versions.length);
  });
});

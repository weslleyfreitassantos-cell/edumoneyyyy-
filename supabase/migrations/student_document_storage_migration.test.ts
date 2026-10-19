import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('./20261018000300_student_document_storage.sql', import.meta.url),
  'utf8',
);

describe('student document storage migration', () => {
  it('creates a private bucket with a constrained file size and formats', () => {
    expect(migration).toContain("'student-documents'");
    expect(migration).toContain('public = false');
    expect(migration).toContain('10485760');
    expect(migration).toContain("'application/pdf'");
    expect(migration).toContain("'image/jpeg'");
  });

  it('scopes storage access to managed institution documents', () => {
    expect(migration).toContain('student_documents_storage_insert');
    expect(migration).toContain('student_documents_storage_select');
    expect(migration).toContain('student_documents_storage_delete');
    expect(migration).toContain('document.file_path = storage.objects.name');
    expect(migration).toContain("document.student_id::text = split_part(storage.objects.name, '/', 2)");
    expect(migration).toContain('public.can_manage_institution_operations(document.institution_id)');
  });
});

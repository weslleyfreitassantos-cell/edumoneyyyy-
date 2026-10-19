// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}));

import {
  STUDENT_DOCUMENTS_BUCKET,
  uploadStudentDocumentFiles,
} from './studentDocumentService';

function createDocumentQuery() {
  const result = Promise.resolve({ data: { id: 'document-1' }, error: null });
  const select = vi.fn(() => ({ maybeSingle: vi.fn(() => result) }));
  const eq = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select })) })) }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq, select };
}

describe('studentDocumentService', () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.storageFrom.mockReset();
  });

  it('envia o arquivo e grava o caminho vinculado ao documento', async () => {
    const query = createDocumentQuery();
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue(query);
    mocks.storageFrom.mockReturnValue({ upload, remove });

    await uploadStudentDocumentFiles('institution-1', 'student-1', [{
      document_type: 'Certidao de nascimento',
      file: new File(['conteudo'], 'certidao.pdf', { type: 'application/pdf' }),
    }]);

    expect(mocks.storageFrom).toHaveBeenCalledWith(STUDENT_DOCUMENTS_BUCKET);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^institution-1\/student-1\/certidao-de-nascimento-[^/]+\.pdf$/),
      expect.any(File),
      expect.objectContaining({ contentType: 'application/pdf', upsert: false }),
    );
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ file_path: expect.any(String) }));
  });

  it('recusa formatos não permitidos antes do upload', async () => {
    const upload = vi.fn();
    mocks.storageFrom.mockReturnValue({
      upload,
      remove: vi.fn().mockResolvedValue({ error: null }),
    });

    await expect(uploadStudentDocumentFiles('institution-1', 'student-1', [{
      document_type: 'CPF',
      file: new File(['conteudo'], 'cpf.exe', { type: 'application/x-msdownload' }),
    }])).rejects.toThrow('Formato não permitido');

    expect(upload).not.toHaveBeenCalled();
  });
});

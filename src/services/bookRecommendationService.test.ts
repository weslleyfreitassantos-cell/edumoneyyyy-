import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import {
  bookRecommendationService,
  matchesBookRecommendationFilters,
  validateBookRecommendationCover,
  validateBookRecommendationInput,
  type BookRecommendation,
} from './bookRecommendationService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

const offering = {
  id: 'offering-1',
  class_id: 'class-1',
  subject_id: 'subject-1',
  teacher_profile_id: 'teacher-1',
  term_id: 'term-1',
  active: true,
  classes: {
    id: 'class-1',
    institution_id: 'institution-1',
    name: '1º ano A',
    grade_level: '1º ano',
    shift: 'MATUTINO',
    active: true,
  },
  subjects: {
    id: 'subject-1',
    institution_id: 'institution-1',
    name: 'Ciências',
    code: 'CIE',
    active: true,
  },
  terms: { id: 'term-1', name: '1º Bimestre', active: true },
};

const row = {
  id: 'recommendation-1',
  institution_id: 'institution-1',
  subject_offering_id: 'offering-1',
  title: 'Livro de ciências',
  author: 'Autora',
  isbn: null,
  note: 'Nota',
  cover_path: null,
  active: true,
  created_by: 'teacher-1',
  created_at: '2026-09-09T10:00:00.000Z',
  updated_at: '2026-09-09T10:00:00.000Z',
  subject_offering: offering,
};

function queryBuilder(data: unknown[] = [row]) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>;

  for (const method of ['select', 'eq', 'order', 'insert', 'update']) {
    builder[method].mockReturnValue(builder);
  }
  builder.single.mockResolvedValue({ data: data[0] ?? null, error: null });
  builder.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data, error: null })));
  return builder;
}

beforeEach(() => vi.clearAllMocks());

describe('bookRecommendationService', () => {
  it('valida capas por tamanho e MIME permitido', () => {
    expect(validateBookRecommendationCover(new File(['cover'], 'cover.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(validateBookRecommendationCover(new File(['cover'], 'cover.svg', { type: 'image/svg+xml' }))).toContain('JPG');
    expect(validateBookRecommendationCover(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'cover.png', { type: 'image/png' }))).toContain('5 MB');
  });

  it('normaliza e valida os campos do formulário', () => {
    expect(validateBookRecommendationInput({
      institutionId: ' institution-1 ',
      subjectOfferingId: ' offering-1 ',
      title: ' Livro ',
      author: ' Autora ',
      isbn: ' 123 ',
      note: ' Nota ',
    })).toEqual({
      institutionId: 'institution-1',
      subjectOfferingId: 'offering-1',
      title: 'Livro',
      author: 'Autora',
      isbn: '123',
      note: 'Nota',
      active: true,
    });
    expect(() => validateBookRecommendationInput({ institutionId: 'i', subjectOfferingId: 'o', title: ' ', author: 'Autor' })).toThrow('título');
  });

  it('lista somente as indicações da instituição e do professor atuais', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    const result = await bookRecommendationService.listForTeacher('institution-1', 'teacher-1');

    expect(result[0].offering.subjectName).toBe('Ciências');
    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(query.eq).toHaveBeenCalledWith('created_by', 'teacher-1');
  });

  it('lista para o aluno apenas indicações ativas da instituição atual', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await bookRecommendationService.listForStudent('institution-1');

    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
    expect(query.eq).toHaveBeenCalledWith('active', true);
  });

  it('cria uma indicação persistindo a oferta, instituição e autor da operação', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await bookRecommendationService.create({
      institutionId: 'institution-1',
      subjectOfferingId: 'offering-1',
      title: ' Livro ',
      author: ' Autora ',
    }, 'teacher-1');

    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      institution_id: 'institution-1',
      subject_offering_id: 'offering-1',
      created_by: 'teacher-1',
      title: 'Livro',
      author: 'Autora',
    }));
  });

  it('cria o registro antes do upload e comunica falha de capa sem repetir a indicação', async () => {
    const query = queryBuilder();
    const upload = vi.fn().mockResolvedValue({ error: new Error('storage indisponível') });
    vi.mocked(supabase.from).mockReturnValue(query as never);
    vi.mocked(supabase.storage.from).mockReturnValue({ upload } as never);

    const result = await bookRecommendationService.createWithCover(
      {
        institutionId: 'institution-1',
        subjectOfferingId: 'offering-1',
        title: 'Livro com capa',
        author: 'Autora',
      },
      'teacher-1',
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    );

    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(result.recommendation.id).toBe('recommendation-1');
    expect(result.coverUploadError).toContain('storage indisponível');
  });

  it('hidrata as capas com uma única chamada de URLs assinadas em lote', async () => {
    const coverPath = 'institution-1/recommendation-1/cover.jpg';
    const query = queryBuilder([{ ...row, cover_path: coverPath }]);
    const createSignedUrls = vi.fn().mockResolvedValue({
      data: [{ path: coverPath, signedUrl: 'https://signed.example/cover' }],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue(query as never);
    vi.mocked(supabase.storage.from).mockReturnValue({ createSignedUrls } as never);

    const result = await bookRecommendationService.listForTeacher('institution-1', 'teacher-1');

    expect(createSignedUrls).toHaveBeenCalledWith([coverPath], 300);
    expect(result[0].coverPath).toBe(coverPath);
    expect(result[0].coverUrl).toBe('https://signed.example/cover');
  });

  it('envia a nova capa, atualiza o path e remove a antiga somente depois da persistência', async () => {
    const oldPath = 'institution-1/recommendation-1/old.png';
    const query = queryBuilder([{ ...row, cover_path: oldPath }]);
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrls = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(query as never);
    vi.mocked(supabase.storage.from).mockReturnValue({ upload, remove, createSignedUrls } as never);

    await bookRecommendationService.uploadCover(
      {
        ...({
          id: 'recommendation-1',
          institutionId: 'institution-1',
          subjectOfferingId: 'offering-1',
          title: 'Livro',
          author: 'Autora',
          isbn: null,
          note: null,
          coverPath: oldPath,
          coverUrl: 'https://signed.example/old',
          active: true,
          createdBy: 'teacher-1',
          createdAt: '',
          updatedAt: '',
          offering: {
            id: 'offering-1',
            classId: 'class-1',
            subjectId: 'subject-1',
            teacherProfileId: 'teacher-1',
            className: '1º ano A',
            gradeLevel: null,
            shift: null,
            subjectName: 'Ciências',
            subjectCode: null,
            termName: '1º',
            active: true,
          },
        } satisfies BookRecommendation),
      },
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    );

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^institution-1\/recommendation-1\/.+\.png$/),
      expect.any(File),
      expect.objectContaining({ contentType: 'image/png', upsert: false }),
    );
    expect(query.update).toHaveBeenCalledWith({
      cover_path: expect.stringMatching(/^institution-1\/recommendation-1\/.+\.png$/),
    });
    expect(remove).toHaveBeenCalledWith([oldPath]);
  });

  it('remove o path primeiro e limpa o arquivo antigo depois', async () => {
    const oldPath = 'institution-1/recommendation-1/old.webp';
    const query = queryBuilder([{ ...row, cover_path: null }]);
    const remove = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue(query as never);
    vi.mocked(supabase.storage.from).mockReturnValue({ remove } as never);

    const recommendation = {
      ...({
        id: 'recommendation-1',
        institutionId: 'institution-1',
        subjectOfferingId: 'offering-1',
        title: 'Livro',
        author: 'Autora',
        isbn: null,
        note: null,
        coverPath: oldPath,
        coverUrl: 'https://signed.example/old',
        active: true,
        createdBy: 'teacher-1',
        createdAt: '',
        updatedAt: '',
        offering: {
          id: 'offering-1',
          classId: 'class-1',
          subjectId: 'subject-1',
          teacherProfileId: 'teacher-1',
          className: '1º ano A',
          gradeLevel: null,
          shift: null,
          subjectName: 'Ciências',
          subjectCode: null,
          termName: '1º',
          active: true,
        },
      } satisfies BookRecommendation),
    };

    await bookRecommendationService.removeCover(recommendation);

    expect(query.update).toHaveBeenCalledWith({ cover_path: null });
    expect(remove).toHaveBeenCalledWith([oldPath]);
  });

  it('atualiza a indicação sem permitir trocar o autor da operação', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await bookRecommendationService.update('recommendation-1', {
      institutionId: 'institution-1',
      subjectOfferingId: 'offering-1',
      title: 'Livro atualizado',
      author: 'Autora atualizada',
      active: false,
    });

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Livro atualizado',
      author: 'Autora atualizada',
      active: false,
    }));
    expect(query.update.mock.calls[0][0]).not.toHaveProperty('created_by');
  });

  it('faz exclusão lógica alterando somente o status ativo', async () => {
    const query = queryBuilder();
    vi.mocked(supabase.from).mockReturnValue(query as never);

    await bookRecommendationService.setActive('recommendation-1', 'institution-1', false);

    expect(query.update).toHaveBeenCalledWith({ active: false });
    expect(query.eq).toHaveBeenCalledWith('id', 'recommendation-1');
    expect(query.eq).toHaveBeenCalledWith('institution_id', 'institution-1');
  });

  it('aplica busca por autor, disciplina ou turma sem expor estado de outro vínculo', () => {
    const recommendation = {
      id: 'id',
      institutionId: 'institution-1',
      subjectOfferingId: 'offering-1',
      title: 'Livro',
      author: 'Autora',
      isbn: null,
      note: null,
      coverPath: null,
      coverUrl: null,
      active: true,
      createdBy: 'teacher-1',
      createdAt: '',
      updatedAt: '',
      offering: {
        id: 'offering-1',
        classId: 'class-1',
        subjectId: 'subject-1',
        teacherProfileId: 'teacher-1',
        className: '1º ano A',
        gradeLevel: null,
        shift: null,
        subjectName: 'Ciências',
        subjectCode: null,
        termName: '1º',
        active: true,
      },
    } satisfies BookRecommendation;

    expect(matchesBookRecommendationFilters(recommendation, { search: 'Ciências' })).toBe(true);
    expect(matchesBookRecommendationFilters(recommendation, { search: 'outra turma' })).toBe(false);
    expect(matchesBookRecommendationFilters({ ...recommendation, active: false }, { status: 'active' })).toBe(false);
  });
});

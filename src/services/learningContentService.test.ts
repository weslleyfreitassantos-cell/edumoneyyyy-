import { beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../lib/supabaseClient';
import { learningContentService } from './learningContentService';

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const post = {
  id: 'post-1',
  institution_id: 'institution-1',
  class_id: 'class-1',
  subject_id: 'subject-1',
  created_by: 'teacher-1',
  post_type: 'MATERIAL',
  title: 'Material',
  body: 'Conteúdo',
  external_url: null,
  pinned: false,
  active: true,
  published_at: '2026-09-05T12:00:00.000Z',
  expires_at: null,
  created_at: '2026-09-05T12:00:00.000Z',
  updated_at: '2026-09-05T12:00:00.000Z',
  subjects: { id: 'subject-1', name: 'Arte', code: 'ART' },
  classes: { id: 'class-1', name: '1º ano A' },
  profiles: { id: 'teacher-1', full_name: 'Professor QA' },
};

function queryBuilder(result: { data: unknown[]; error: null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    or: vi.fn(),
  } as Record<string, ReturnType<typeof vi.fn>>;

  for (const method of ['select', 'eq', 'in', 'order', 'range', 'or']) {
    builder[method].mockReturnValue(builder);
  }
  builder.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve({ ...result, count: result.data.length })));
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('learningContentService.listPosts', () => {
  it('mantém a listagem principal independente de anexos e leituras', async () => {
    const postsQuery = queryBuilder({ data: [post], error: null });
    const attachmentsQuery = queryBuilder({
      data: [{
        post_id: 'post-1',
        id: 'attachment-1',
        file_name: 'material.txt',
        mime_type: 'text/plain',
        size_bytes: 12,
        storage_path: 'institution/institution-1/post/post-1/material.txt',
        created_at: '2026-09-05T12:00:00.000Z',
      }],
      error: null,
    });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(postsQuery as never)
      .mockReturnValueOnce(attachmentsQuery as never);

    const result = await learningContentService.listPosts(
      'institution-1',
      'teacher-1',
      {},
      { includeReadState: false },
    );

    expect(result.posts[0].attachments).toHaveLength(1);
    expect(result.posts[0].isRead).toBe(false);
    expect(vi.mocked(supabase.from)).toHaveBeenCalledTimes(2);
    expect(postsQuery.select.mock.calls[0][0]).not.toContain('learning_post_reads');
    expect(postsQuery.select.mock.calls[0][0]).not.toContain('learning_post_attachments');
  });

  it('carrega somente a leitura do perfil atual para o aluno', async () => {
    const postsQuery = queryBuilder({ data: [post], error: null });
    const attachmentsQuery = queryBuilder({ data: [], error: null });
    const readsQuery = queryBuilder({ data: [{ post_id: 'post-1' }], error: null });
    vi.mocked(supabase.from)
      .mockReturnValueOnce(postsQuery as never)
      .mockReturnValueOnce(attachmentsQuery as never)
      .mockReturnValueOnce(readsQuery as never);

    const result = await learningContentService.listPosts(
      'institution-1',
      'student-1',
      {},
      { includeReadState: true },
    );

    expect(result.posts[0].isRead).toBe(true);
    expect(readsQuery.eq).toHaveBeenCalledWith('profile_id', 'student-1');
    expect(readsQuery.select).toHaveBeenCalledWith('post_id');
  });
});

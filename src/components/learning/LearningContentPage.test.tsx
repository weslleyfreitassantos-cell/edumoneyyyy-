// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LearningPost } from '../../services/learningContentService';

const state = vi.hoisted(() => ({
  role: 'TEACHER' as 'TEACHER' | 'STUDENT',
  posts: [] as LearningPost[],
  markRead: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      id: 'profile-1',
      full_name: 'Pessoa de teste',
      email: 'teste@example.com',
      role: state.role,
      platform_role: 'USER',
      avatar_url: null,
    },
  }),
}));

vi.mock('../../contexts/InstitutionContext', () => ({
  useInstitution: () => ({
    currentInstitutionId: 'institution-1',
    currentRole: state.role,
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useLearningContent', () => ({
  useLearningPosts: () => ({
    data: { posts: state.posts, total: state.posts.length, page: 1, pageSize: 20 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useTeacherLearningTargets: () => ({
    data: [{
      classId: 'class-1',
      className: '1º ano A',
      subjectId: 'subject-1',
      subjectName: 'Matemática',
      subjectCode: 'MAT',
    }],
  }),
  useStudentLearningTargets: () => ({
    data: [{
      classId: 'class-1',
      className: '1º ano A',
      subjectId: 'subject-1',
      subjectName: 'Matemática',
      subjectCode: 'MAT',
    }],
  }),
  useCreateLearningPost: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateLearningPost: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useArchiveLearningPost: () => ({ isPending: false, mutate: vi.fn() }),
  useToggleLearningPostPin: () => ({ isPending: false, mutate: vi.fn() }),
  useDeleteLearningPost: () => ({ isPending: false, mutate: vi.fn() }),
  useMarkLearningPostRead: () => ({ isPending: false, mutate: state.markRead }),
}));

import LearningContentPage from './LearningContentPage';

afterEach(() => {
  cleanup();
  state.role = 'TEACHER';
  state.posts = [];
  state.markRead.mockReset();
});

const studentPost: LearningPost = {
  id: 'post-1',
  institutionId: 'institution-1',
  classId: 'class-1',
  className: '1º ano A',
  subjectId: 'subject-1',
  subjectName: 'Matemática',
  subjectCode: 'MAT',
  createdBy: 'teacher-1',
  teacherName: 'Professor teste',
  postType: 'NOTICE',
  title: 'Aviso de prova',
  body: 'A prova será na próxima semana.',
  externalUrl: null,
  pinned: false,
  active: true,
  publishedAt: '2026-09-05T12:00:00.000Z',
  expiresAt: null,
  createdAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
  attachments: [],
  isRead: false,
};

describe('LearningContentPage', () => {
  it('exposes the composer to teachers and keeps the student feed action-free', () => {
    render(<LearningContentPage />);
    expect(screen.getAllByRole('button', { name: /Nova publicação/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Tudo em dia por aqui')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: /Nova publicação/i })[0]);
    expect(screen.getByRole('dialog', { name: 'Materiais e avisos' })).toBeTruthy();
    expect(screen.getByText('Escolha um destino válido para o seu perfil de professor.')).toBeTruthy();
  });

  it('marks a student post as read only when its detail is opened', () => {
    state.role = 'STUDENT';
    state.posts = [studentPost];
    render(<LearningContentPage />);

    expect(screen.getByText('1 não lido(s)')).toBeTruthy();
    expect(state.markRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Aviso de prova/ }));
    expect(screen.getByRole('dialog', { name: 'Aviso de prova' })).toBeTruthy();
    expect(state.markRead).toHaveBeenCalledWith({ postId: 'post-1', profileId: 'profile-1' });
  });
});

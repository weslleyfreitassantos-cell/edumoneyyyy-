// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ProfileHeroAvatar from './ProfileHeroAvatar';

afterEach(() => {
  cleanup();
});

describe('ProfileHeroAvatar', () => {
  it('renders the shared 3:4 object-fill slot', () => {
    render(
      <ProfileHeroAvatar
        avatarUrl="https://storage.example/avatar.webp"
        fullName="Ana Silva"
        fallback={<span>Fallback</span>}
      />,
    );

    const image = screen.getByRole('img', { name: 'Foto de Ana Silva' });

    expect(image.className).toContain('object-fill');
    expect(image.parentElement?.className).toContain('aspect-[3/4]');
    expect(image.parentElement?.className).toContain('w-36');
    expect(image.parentElement?.className).toContain('sm:w-40');
  });

  it('falls back when the image cannot be loaded', () => {
    render(
      <ProfileHeroAvatar
        avatarUrl="https://storage.example/broken.webp"
        fullName="Ana Silva"
        fallback={<span>Fallback</span>}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Foto de Ana Silva' }));

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Fallback')).toBeTruthy();
  });
});

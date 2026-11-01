// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import KoreanText from './KoreanText';

describe('KoreanText', () => {
  afterEach(cleanup);

  it('shows Hangul with its romanization while preserving the original text', () => {
    render(<p><KoreanText text="안녕하세요!" enabled /></p>);

    expect(screen.getByText('안녕하세요!')).toBeTruthy();
    expect(screen.getByText('(annyeonghaseyo)')).toBeTruthy();
  });

  it('does not add Korean readings when the selected course is not Korean', () => {
    render(<p><KoreanText text="안녕하세요!" enabled={false} /></p>);

    expect(screen.getByText('안녕하세요!')).toBeTruthy();
    expect(screen.queryByText('(annyeonghaseyo)')).toBeNull();
  });
});

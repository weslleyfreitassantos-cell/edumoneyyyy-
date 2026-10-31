import { describe, expect, it } from 'vitest';

import { koreanRomanizationParts, koreanRomanizedText } from './koreanRomanization';

const canonicalKoreanContent = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㅁ', 'ㅂ', 'ㅏ', 'ㅓ', 'ㅗ', '가', '가세요', '감사합니다', '계세요',
  '고맙습니다', '구', '나', '네', '는', '다', '당신', '마', '만나서', '맞아요', '문', '물',
  '뭐예요', '민지', '민지예요', '바', '반가워요', '사', '삼', '선생님', '십', '아니요', '아닙니다',
  '안녕하세요', '안녕히', '예요', '오', '육', '이', '이름은', '이름이', '일', '저', '저는', '제',
  '주세요', '집', '차', '책', '칠', '커피', '팔', '학교', '학생이에요',
];

describe('Korean learner readings', () => {
  it.each(canonicalKoreanContent)('has an explicit reading for canonical text: %s', (text) => {
    expect(koreanRomanizationParts(text)).toContainEqual({ text, romanization: expect.any(String) });
  });

  it('renders Hangul first and keeps punctuation and surrounding Portuguese intact', () => {
    expect(koreanRomanizedText('Olá! 안녕하세요, 감사합니다.'))
      .toBe('Olá! 안녕하세요 (annyeonghaseyo), 감사합니다 (gamsahamnida).');
  });

  it('uses the course reading for complete expressions before smaller word matches', () => {
    expect(koreanRomanizedText('제 이름은 민지예요.')).toBe('제 이름은 민지예요 (je ireumeun Minji-yeyo).');
    expect(koreanRomanizedText('안녕히 가세요')).toBe('안녕히 가세요 (annyeonghi gaseyo)');
  });

  it('does not duplicate a supplied reading or invent a reading for unknown Hangul', () => {
    expect(koreanRomanizedText('안녕하세요 (annyeonghaseyo)')).toBe('안녕하세요 (annyeonghaseyo)');
    expect(koreanRomanizedText('뷁')).toBe('뷁');
  });
});

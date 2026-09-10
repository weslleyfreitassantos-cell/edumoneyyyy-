export const BOOK_RECOMMENDATION_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const BOOK_RECOMMENDATION_COVER_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export function validateBookRecommendationCover(file: File | null | undefined): string | null {
  if (!file) return null;
  if (file.size > BOOK_RECOMMENDATION_COVER_MAX_BYTES) {
    return 'A capa deve ter no máximo 5 MB.';
  }
  if (!(BOOK_RECOMMENDATION_COVER_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'A capa deve estar em JPG, PNG ou WebP.';
  }
  return null;
}

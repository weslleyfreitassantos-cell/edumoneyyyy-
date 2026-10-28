export type TecLanguageLocale = 'en-US' | 'es-ES' | 'ko-KR' | 'fr-FR' | 'de-DE' | 'it-IT' | 'ja-JP' | 'zh-CN';

export function tecLanguageLocale(courseCode?: string, skillCode?: string): TecLanguageLocale {
  if (courseCode?.includes('FRENCH') || skillCode?.startsWith('fr_v1_')) return 'fr-FR';
  if (courseCode?.includes('GERMAN') || skillCode?.startsWith('de_v1_')) return 'de-DE';
  if (courseCode?.includes('ITALIAN') || skillCode?.startsWith('it_v1_')) return 'it-IT';
  if (courseCode?.includes('JAPANESE') || skillCode?.startsWith('ja_v1_')) return 'ja-JP';
  if (courseCode?.includes('MANDARIN') || courseCode?.includes('CHINESE') || skillCode?.startsWith('zh_v1_')) return 'zh-CN';
  if (courseCode?.includes('SPANISH') || skillCode?.startsWith('es_v1_')) return 'es-ES';
  if (courseCode?.includes('KOREAN') || skillCode?.startsWith('ko_v1_')) return 'ko-KR';
  return 'en-US';
}

export function tecLanguageDisplayName(courseCode?: string, skillCode?: string): string {
  const locale = tecLanguageLocale(courseCode, skillCode);
  return ({
    'en-US': 'Inglês',
    'es-ES': 'Espanhol',
    'ko-KR': 'Coreano',
    'fr-FR': 'Francês',
    'de-DE': 'Alemão',
    'it-IT': 'Italiano',
    'ja-JP': 'Japonês',
    'zh-CN': 'Mandarim',
  } satisfies Record<TecLanguageLocale, string>)[locale];
}

export function tecLanguageName(courseCode?: string, skillCode?: string): string {
  switch (tecLanguageLocale(courseCode, skillCode)) {
    case 'es-ES': return 'espanhol';
    case 'ko-KR': return 'coreano';
    case 'fr-FR': return 'francês';
    case 'de-DE': return 'alemão';
    case 'it-IT': return 'italiano';
    case 'ja-JP': return 'japonês';
    case 'zh-CN': return 'mandarim';
    default: return 'inglês';
  }
}

export type TecLanguageLocale = 'en-US' | 'es-ES' | 'ko-KR';

export function tecLanguageLocale(courseCode?: string, skillCode?: string): TecLanguageLocale {
  if (courseCode?.includes('SPANISH') || skillCode?.startsWith('es_v1_')) return 'es-ES';
  if (courseCode?.includes('KOREAN') || skillCode?.startsWith('ko_v1_')) return 'ko-KR';
  return 'en-US';
}

export function tecLanguageName(courseCode?: string, skillCode?: string): string {
  switch (tecLanguageLocale(courseCode, skillCode)) {
    case 'es-ES': return 'espanhol';
    case 'ko-KR': return 'coreano';
    default: return 'inglês';
  }
}

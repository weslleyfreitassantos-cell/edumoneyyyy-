export type GuidedVisualStimulusImage = {
  src: string;
  alt: string;
  caption?: string;
};

const MAX_STIMULUS_ITEMS_TO_INSPECT = 64;
const MAX_STIMULUS_IMAGES_TO_RENDER = 8;
const MAX_TEXT_LENGTH = 500;
const LEARNING_ASSET_ORIGIN = 'https://learning.invalid';

function decodedPath(path: string): string | null {
  let decoded = path;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) return decoded;
    decoded = next;
  }

  // A still-changing path after repeated decoding is ambiguous; fail closed
  // instead of letting a downstream server decode it further.
  return null;
}

function isSafeLearningImagePath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  if (
    !source || source.length > 2048 || !source.startsWith('/learning/')
    || source.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(source)
  ) return false;

  const rawPath = source.split(/[?#]/, 1)[0];
  const decodedRawPath = decodedPath(rawPath);
  if (
    !decodedRawPath || !decodedRawPath.startsWith('/learning/')
    || decodedRawPath.startsWith('//') || decodedRawPath.includes('\\')
    || decodedRawPath.split('/').some((segment) => segment === '.' || segment === '..')
    || decodedRawPath.split('/').slice(2).some((segment) => segment.length === 0)
  ) return false;

  try {
    const parsed = new URL(source, LEARNING_ASSET_ORIGIN);
    const decodedParsedPath = decodedPath(parsed.pathname);
    return parsed.origin === LEARNING_ASSET_ORIGIN
      && Boolean(decodedParsedPath?.startsWith('/learning/'))
      && !decodedParsedPath?.includes('\\')
      && !decodedParsedPath?.split('/').some((segment) => segment === '.' || segment === '..');
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates API metadata before it can create network requests or break a question. */
export function normalizeGuidedVisualStimulus(value: unknown): GuidedVisualStimulusImage[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];

  const normalized: GuidedVisualStimulusImage[] = [];
  const seenSources = new Set<string>();
  for (const candidate of value.items.slice(0, MAX_STIMULUS_ITEMS_TO_INSPECT)) {
    if (!isRecord(candidate) || !isSafeLearningImagePath(candidate.src)) continue;
    if (typeof candidate.alt !== 'string' || !candidate.alt.trim()) continue;

    const src = candidate.src.trim();
    if (seenSources.has(src)) continue;
    seenSources.add(src);

    const image: GuidedVisualStimulusImage = {
      src,
      alt: candidate.alt.trim().slice(0, MAX_TEXT_LENGTH),
    };
    if (typeof candidate.caption === 'string' && candidate.caption.trim()) {
      image.caption = candidate.caption.trim().slice(0, MAX_TEXT_LENGTH);
    }
    normalized.push(image);
    if (normalized.length >= MAX_STIMULUS_IMAGES_TO_RENDER) break;
  }

  return normalized;
}

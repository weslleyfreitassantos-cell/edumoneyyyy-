import { describe, expect, it } from 'vitest';

import { normalizeGuidedVisualStimulus } from './guidedVisualStimulus';

describe('normalizeGuidedVisualStimulus', () => {
  it.each([undefined, null, 'invalid', {}, { items: null }, { items: 'image' }])(
    'returns no images for malformed container %j',
    (value) => expect(normalizeGuidedVisualStimulus(value)).toEqual([]),
  );

  it('skips malformed image entries, requires descriptive alt text, and accepts only learning assets', () => {
    let deeplyEncodedTraversal = '../private.svg';
    for (let attempt = 0; attempt < 9; attempt += 1) {
      deeplyEncodedTraversal = encodeURIComponent(deeplyEncodedTraversal);
    }

    const result = normalizeGuidedVisualStimulus({ items: [
      null,
      { src: 3, alt: 'not a path' },
      { src: '/learning/image.svg' },
      { src: '/learning/image.svg', alt: '   ' },
      { src: 'https://outside.example/image.png', alt: 'external' },
      { src: '//outside.example/image.png', alt: 'protocol-relative' },
      { src: '/admin/private.svg', alt: 'outside learning' },
      { src: '/learning/../private.svg', alt: 'literal traversal' },
      { src: '/learning/%2e%2e/private.svg', alt: 'encoded traversal' },
      { src: '/learning/%252e%252e/private.svg', alt: 'nested encoded traversal' },
      { src: `/learning/${deeplyEncodedTraversal}`, alt: 'deeply encoded traversal' },
      { src: '/learning\\private.svg', alt: 'backslash' },
      { src: '/learning/valid.svg', alt: '  A valid image.  ', caption: 12 },
    ] });

    expect(result).toEqual([{ src: '/learning/valid.svg', alt: 'A valid image.' }]);
  });

  it('preserves string captions, removes duplicates, and bounds the rendered list', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      src: `/learning/image-${index}.svg`,
      alt: `Image ${index}`,
      caption: index === 0 ? '  First image  ' : undefined,
    }));
    items.push({ src: '/learning/image-0.svg', alt: 'Duplicate', caption: undefined });

    const result = normalizeGuidedVisualStimulus({ items });

    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ src: '/learning/image-0.svg', alt: 'Image 0', caption: 'First image' });
    expect(new Set(result.map((item) => item.src)).size).toBe(result.length);
  });
});

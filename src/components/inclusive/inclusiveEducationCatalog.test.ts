import { describe, expect, it } from 'vitest';
import { externalResources, inclusiveActivities } from './inclusiveEducationCatalog';

describe('inclusive education catalog', () => {
  it('contains original activities with usable content', () => {
    expect(inclusiveActivities.length).toBeGreaterThanOrEqual(16);
    expect(inclusiveActivities.every((activity) => activity.title && activity.objective && activity.content.length > 0)).toBe(true);
  });

  it('keeps external resources as source links instead of copied files', () => {
    expect(externalResources.length).toBe(24);
    expect(externalResources.every((resource) => resource.url.startsWith('https://') && resource.author && resource.license)).toBe(true);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContentPackages } from './build-content-packages.mjs';

const root = process.cwd();
const packRoot = path.resolve(root, 'content/adaptive/tec-escola-core-v4');
const promotions = JSON.parse(
  fs.readFileSync(path.resolve(root, 'content/bncc/mappings/promoted-2018.json'), 'utf8'),
);

describe('BNCC safe promotion content canary', () => {
  it('keeps every safe promotion backed by an adaptive-ready runtime skill', () => {
    const packages = buildContentPackages(packRoot).packages.flatMap((item) => item.skills);
    const skillsByCode = new Map(packages.map((skill) => [skill.code, skill]));

    for (const promotion of promotions.promotions) {
      for (const code of promotion.canonicalSkillCodes) {
        expect(skillsByCode.get(code)).toMatchObject({
          readiness: 'ADAPTIVE_READY',
          contentStatus: 'TECH_VALIDATED',
        });
      }
    }
  });
});

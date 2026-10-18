import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceVerification = JSON.parse(fs.readFileSync('content/bncc/authoring/source-verification-v2.json', 'utf8'));
const coverage = JSON.parse(fs.readFileSync('content/bncc/mappings/coverage-2018.json', 'utf8'));

const expectedDescriptors = {
  EI01CG01: 'Movimentar as partes do corpo para exprimir corporalmente emoções, necessidades e desejos.',
  EI01CG02: 'Experimentar as possibilidades corporais nas brincadeiras e interações em ambientes acolhedores e desafiantes.',
  EI01CG03: 'Imitar gestos e movimentos de outras crianças, adultos e animais.',
  EI01CG04: 'Participar do cuidado do seu corpo e da promoção do seu bem-estar.',
  EI02CG01: 'Apropriar-se de gestos e movimentos de sua cultura no cuidado de si e nos jogos e brincadeiras.',
  EI03CG01: 'Criar com o corpo formas diversificadas de expressão de sentimentos, sensações e emoções, tanto nas situações do cotidiano quanto em brincadeiras, dança, teatro, música.',
};
const versionByCode = { EI01CG01: 1, EI02CG01: 2, EI03CG01: 3, EI01CG02: 4, EI01CG03: 5, EI01CG04: 6 };

describe('early-childhood observation packages', () => {
  it('keeps the verified official descriptors while leaving curricular mapping unclaimed', () => {
    for (const [code, descriptor] of Object.entries(expectedDescriptors)) {
      const record = sourceVerification.records.find((item) => item.officialCode === code);
      const mapping = coverage.mappings.find((item) => item.officialCode === code);
      expect(record).toMatchObject({
        descriptor,
        technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
        officialSource: {
          url: 'https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf',
          page: 49,
        },
      });
      expect(mapping?.status).toBe('HIERARCHY_ONLY');
      const packagePath = path.resolve(`content/bncc/authoring/early-childhood-experiential-v${versionByCode[code]}.json`);
      expect(fs.existsSync(packagePath)).toBe(true);
    }
  });

  it('keeps observation evidence staged, private, and quiz-free', () => {
    for (const version of [1, 2, 3, 4, 5, 6]) {
      const pack = JSON.parse(fs.readFileSync(`content/bncc/authoring/early-childhood-experiential-v${version}.json`, 'utf8'));
      expect(pack).toMatchObject({ active: false, evidenceMode: 'EDUCATOR_MEDIATED_OBSERVATION' });
      expect(pack.contentStatus).toMatchObject({
        publicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
        officialMappingStatus: 'NOT_CLAIMED',
        studentQuiz: 'NOT_CREATED',
        humanApproval: 'NOT_GRANTED',
      });
      expect(pack.learningDesign.observationExperiences).toHaveLength(2);
      expect(pack.learningDesign.observationCriteria.length).toBeGreaterThanOrEqual(5);
      expect(pack.learningDesign.evidenceRecord.privacy).toMatch(/não|nao|privacidade|imagem|diagnóstico|diagnostico/i);
      expect(pack.questions ?? []).toHaveLength(0);
    }
  });
});

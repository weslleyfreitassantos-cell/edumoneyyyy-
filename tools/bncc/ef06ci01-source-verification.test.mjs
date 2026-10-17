import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const sourceVerification = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/authoring/source-verification-v2.json'),
  'utf8',
));
const resolutions = JSON.parse(fs.readFileSync(
  path.resolve(root, 'content/bncc/mappings/resolutions-v8.json'),
  'utf8',
));

describe('EF06CI01 source verification', () => {
  it('records the exact official descriptor without promoting its mapping', () => {
    const record = sourceVerification.records.find((item) => item.officialCode === 'EF06CI01');
    const resolution = resolutions.decisions.find((item) => item.officialCode === 'EF06CI01');

    expect(record).toMatchObject({
      verificationId: 'BNCC_EF06CI01_MEC_P346_V1',
      technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
      mappingStatus: 'HUMAN_REVIEW_BLOCKED',
      studentPublicationStatus: 'STAGING_INACTIVE',
      pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    });
    expect(record.descriptor).toBe(
      'Classificar como homogênea ou heterogênea a mistura de dois ou mais materiais (água e sal, água e óleo, água e areia etc.).',
    );
    expect(resolution.resolutionStatus).toBe('HUMAN_REVIEW_BLOCKED');
    expect(resolution.relationCandidates).toEqual([
      {
        canonicalSkillCode: 'SCIENCE_EXPLAIN_MATTER_TRANSFORMATION',
        relationType: null,
        decision: 'NOT_ASSERTED',
      },
    ]);

    const pendingAudit = JSON.parse(fs.readFileSync(
      path.resolve(root, 'content/bncc/authoring/pending-coverage-audit-v3.json'),
      'utf8',
    ));
    const auditRecord = pendingAudit.records.find((item) => item.officialCode === 'EF06CI01');
    expect(auditRecord.queueStatus).toBe('MAPPING_REVIEW_REQUIRED');
    expect(auditRecord.nextAction).toBe('AUTHOR_CONTENT_AFTER_CANONICAL_REVIEW');
  });

  it('keeps the next science descriptors source-verified and unpublished', () => {
    const expected = {
      EF06CI02: 'HUMAN_REVIEW_BLOCKED',
      EF06CI03: 'CANONICAL_GAP',
      EF06CI04: 'CANONICAL_GAP',
      EF06CI05: 'CANONICAL_GAP',
      EF06CI06: 'CANONICAL_GAP',
      EF06CI07: 'CANONICAL_GAP',
      EF06CI08: 'CANONICAL_GAP',
      EF06CI09: 'CANONICAL_GAP',
      EF06CI10: 'CANONICAL_GAP',
      EF06CI11: 'CANONICAL_GAP',
      EF06CI12: 'CANONICAL_GAP',
      EF06CI13: 'CANONICAL_GAP',
      EF06CI14: 'CANONICAL_GAP',
      EF07CI01: 'CANONICAL_GAP',
      EF07CI02: 'CANONICAL_GAP',
      EF07CI03: 'CANONICAL_GAP',
      EF07CI04: 'CANONICAL_GAP',
      EF07CI05: 'CANONICAL_GAP',
      EF07CI06: 'CANONICAL_GAP',
      EF07CI07: 'CANONICAL_GAP',
      EF07CI08: 'CANONICAL_GAP',
      EF07CI09: 'CANONICAL_GAP',
      EF07CI10: 'CANONICAL_GAP',
      EF07CI11: 'CANONICAL_GAP',
      EF07CI12: 'CANONICAL_GAP',
      EF07CI13: 'CANONICAL_GAP',
      EF07CI14: 'CANONICAL_GAP',
      EF07CI15: 'CANONICAL_GAP',
      EF07CI16: 'CANONICAL_GAP',
      EF08CI01: 'CANONICAL_GAP',
      EF08CI02: 'CANONICAL_GAP',
      EF08CI03: 'CANONICAL_GAP',
      EF08CI04: 'HUMAN_REVIEW_BLOCKED',
      EF08CI05: 'HUMAN_REVIEW_BLOCKED',
      EF08CI06: 'HUMAN_REVIEW_BLOCKED',
      EF08CI07: 'HUMAN_REVIEW_BLOCKED',
      EF08CI08: 'HUMAN_REVIEW_BLOCKED',
      EF08CI09: 'CANONICAL_GAP',
      EF08CI10: 'CANONICAL_GAP',
      EF08CI11: 'HUMAN_REVIEW_BLOCKED',
      EF08CI12: 'HUMAN_REVIEW_BLOCKED',
      EF08CI13: 'HUMAN_REVIEW_BLOCKED',
      EF08CI14: 'HUMAN_REVIEW_BLOCKED',
      EF08CI15: 'HUMAN_REVIEW_BLOCKED',
      EF08CI16: 'HUMAN_REVIEW_BLOCKED',
      EF09CI02: 'HUMAN_REVIEW_BLOCKED',
      EF09CI03: 'CANONICAL_GAP',
      EF09CI04: 'CANONICAL_GAP',
      EF09CI05: 'CANONICAL_GAP',
      EF09CI06: 'CANONICAL_GAP',
      EF09CI07: 'CANONICAL_GAP',
      EF09CI08: 'CANONICAL_GAP',
      EF09CI09: 'CANONICAL_GAP',
      EF09CI10: 'CANONICAL_GAP',
      EF09CI11: 'CANONICAL_GAP',
      EF09CI12: 'CANONICAL_GAP',
      EF09CI13: 'CANONICAL_GAP',
      EF09CI14: 'CANONICAL_GAP',
      EF09CI15: 'CANONICAL_GAP',
      EF09CI16: 'CANONICAL_GAP',
      EF09CI17: 'CANONICAL_GAP',
      EF09CO01: 'HUMAN_REVIEW_BLOCKED',
      EF09CO02: 'HUMAN_REVIEW_BLOCKED',
      EF09CO03: 'CANONICAL_GAP',
      EF09CO04: 'CANONICAL_GAP',
      EF09CO05: 'HUMAN_REVIEW_BLOCKED',
      EF09CO06: 'HUMAN_REVIEW_BLOCKED',
      EF09CO07: 'HUMAN_REVIEW_BLOCKED',
      EF09CO08: 'HUMAN_REVIEW_BLOCKED',
      EF09CO09: 'HUMAN_REVIEW_BLOCKED',
      EF09CO10: 'CANONICAL_GAP',
      EF09ER01: 'CANONICAL_GAP',
      EF09ER02: 'CANONICAL_GAP',
      EF09ER03: 'CANONICAL_GAP',
      EF09ER04: 'CANONICAL_GAP',
      EF09ER05: 'CANONICAL_GAP',
      EF09ER06: 'CANONICAL_GAP',
      EF09ER07: 'CANONICAL_GAP',
      EF09ER08: 'CANONICAL_GAP',
      EF09GE01: 'CANONICAL_GAP',
      EF09GE02: 'CANONICAL_GAP',
      EF09GE03: 'CANONICAL_GAP',
      EF09GE04: 'CANONICAL_GAP',
      EF09GE05: 'CANONICAL_GAP',
      EF09GE06: 'CANONICAL_GAP',
      EF09GE07: 'CANONICAL_GAP',
      EF09GE08: 'CANONICAL_GAP',
      EF09GE09: 'CANONICAL_GAP',
      EF09GE10: 'CANONICAL_GAP',
      EF09GE11: 'CANONICAL_GAP',
      EF09GE12: 'CANONICAL_GAP',
      EF09GE13: 'HUMAN_REVIEW_BLOCKED',
      EF09GE14: 'HUMAN_REVIEW_BLOCKED',
      EF09GE15: 'CANONICAL_GAP',
      EF09GE16: 'CANONICAL_GAP',
      EF09GE17: 'CANONICAL_GAP',
      EF09GE18: 'CANONICAL_GAP',
      EF09HI01: 'CANONICAL_GAP',
      EF09HI02: 'CANONICAL_GAP',
      EF09HI03: 'CANONICAL_GAP',
      EF09HI04: 'CANONICAL_GAP',
      EF09HI05: 'CANONICAL_GAP',
      EF09HI06: 'CANONICAL_GAP',
      EF09HI07: 'CANONICAL_GAP',
      EF09HI08: 'CANONICAL_GAP',
      EF09HI09: 'CANONICAL_GAP',
      EF09HI10: 'CANONICAL_GAP',
      EF09HI11: 'CANONICAL_GAP',
      EF09HI12: 'CANONICAL_GAP',
      EF09HI13: 'CANONICAL_GAP',
      EF09HI14: 'CANONICAL_GAP',
      EF09HI15: 'CANONICAL_GAP',
      EF09HI16: 'HUMAN_REVIEW_BLOCKED',
      EF09HI17: 'HUMAN_REVIEW_BLOCKED',
      EF09HI18: 'HUMAN_REVIEW_BLOCKED',
      EF09HI19: 'HUMAN_REVIEW_BLOCKED',
      EF09HI20: 'CANONICAL_GAP',
      EF09HI21: 'CANONICAL_GAP',
      EF09HI22: 'CANONICAL_GAP',
      EF09HI23: 'CANONICAL_GAP',
      EF09HI24: 'HUMAN_REVIEW_BLOCKED',
      EF09HI25: 'HUMAN_REVIEW_BLOCKED',
      EF09HI26: 'HUMAN_REVIEW_BLOCKED',
      EF09HI27: 'HUMAN_REVIEW_BLOCKED',
      EF09HI28: 'CANONICAL_GAP',
      EF09HI29: 'CANONICAL_GAP',
      EF09HI30: 'CANONICAL_GAP',
      EF09HI31: 'CANONICAL_GAP',
      EF09HI32: 'CANONICAL_GAP',
      EF09HI33: 'CANONICAL_GAP',
      EF09HI34: 'CANONICAL_GAP',
      EF09HI35: 'CANONICAL_GAP',
      EF09HI36: 'CANONICAL_GAP',
      EF09LI01: 'CANONICAL_GAP',
      EF09LI02: 'CANONICAL_GAP',
      EF09LI03: 'CANONICAL_GAP',
      EF09LI04: 'CANONICAL_GAP',
      EF09LI05: 'CANONICAL_GAP',
      EF09LI06: 'CANONICAL_GAP',
      EF09LI07: 'CANONICAL_GAP',
      EF09LI08: 'CANONICAL_GAP',
      EF09LI09: 'CANONICAL_GAP',
      EF09LI10: 'CANONICAL_GAP',
      EF09LI11: 'CANONICAL_GAP',
      EF09LI12: 'CANONICAL_GAP',
      EF09LI13: 'CANONICAL_GAP',
      EF09LI14: 'CANONICAL_GAP',
      EF09LI15: 'CANONICAL_GAP',
      EF09LI16: 'CANONICAL_GAP',
      EF09LI17: 'CANONICAL_GAP',
      EF09LI18: 'CANONICAL_GAP',
      EF09LI19: 'CANONICAL_GAP',
      EF09MA01: 'CANONICAL_GAP',
      EF09MA02: 'CANONICAL_GAP',
      EF09MA03: 'CANONICAL_GAP',
      EF09MA04: 'CANONICAL_GAP',
      EF09MA05: 'CANONICAL_GAP',
      EF09MA06: 'CANONICAL_GAP',
      EF09MA07: 'CANONICAL_GAP',
      EF09MA08: 'CANONICAL_GAP',
      EF09MA09: 'CANONICAL_GAP',
      EF09MA10: 'CANONICAL_GAP',
      EF09MA11: 'CANONICAL_GAP',
      EF09MA12: 'CANONICAL_GAP',
      EF09MA13: 'CANONICAL_GAP',
      EF09MA14: 'CANONICAL_GAP',
      EF09MA15: 'CANONICAL_GAP',
      EF09MA16: 'CANONICAL_GAP',
      EF09MA17: 'CANONICAL_GAP',
      EF09MA18: 'CANONICAL_GAP',
      EF09MA19: 'CANONICAL_GAP',
      EF09MA20: 'CANONICAL_GAP',
      EF09MA21: 'CANONICAL_GAP',
      EF09MA22: 'CANONICAL_GAP',
      EF09MA23: 'CANONICAL_GAP',
      EF01CI01: 'CANONICAL_GAP',
      EF01CI02: 'CANONICAL_GAP',
      EF01CI03: 'CANONICAL_GAP',
      EF01CI04: 'CANONICAL_GAP',
      EF01CI05: 'CANONICAL_GAP',
      EF01CI06: 'CANONICAL_GAP',
      EF02CI01: 'CANONICAL_GAP',
      EF02CI02: 'CANONICAL_GAP',
      EF02CI03: 'CANONICAL_GAP',
      EF02CI04: 'CANONICAL_GAP',
      EF02CI05: 'CANONICAL_GAP',
      EF02CI06: 'CANONICAL_GAP',
      EF02CI07: 'CANONICAL_GAP',
      EF02CI08: 'CANONICAL_GAP',
      EF03CI01: 'CANONICAL_GAP',
      EF03CI02: 'CANONICAL_GAP',
      EF03CI03: 'CANONICAL_GAP',
      EF03CI04: 'CANONICAL_GAP',
      EF03CI05: 'CANONICAL_GAP',
      EF03CI06: 'CANONICAL_GAP',
      EF03CI07: 'CANONICAL_GAP',
      EF03CI08: 'CANONICAL_GAP',
      EF03CI09: 'CANONICAL_GAP',
      EF03CI10: 'CANONICAL_GAP',
      EF04CI01: 'CANONICAL_GAP',
      EF04CI02: 'CANONICAL_GAP',
      EF04CI03: 'CANONICAL_GAP',
      EF04CI04: 'CANONICAL_GAP',
      EF04CI05: 'CANONICAL_GAP',
      EF04CI06: 'CANONICAL_GAP',
      EF04CI07: 'CANONICAL_GAP',
      EF04CI08: 'CANONICAL_GAP',
      EF04CI09: 'CANONICAL_GAP',
      EF04CI10: 'CANONICAL_GAP',
      EF04CI11: 'CANONICAL_GAP',
      EF05CI01: 'CANONICAL_GAP',
      EF05CI02: 'CANONICAL_GAP',
      EF05CI03: 'CANONICAL_GAP',
      EF05CI04: 'CANONICAL_GAP',
      EF05CI05: 'CANONICAL_GAP',
      EF05CI06: 'CANONICAL_GAP',
      EF05CI07: 'CANONICAL_GAP',
      EF05CI08: 'CANONICAL_GAP',
      EF05CI09: 'CANONICAL_GAP',
      EF05CI10: 'CANONICAL_GAP',
      EF05CI11: 'CANONICAL_GAP',
      EF05CI12: 'CANONICAL_GAP',
      EF05CI13: 'CANONICAL_GAP',
      EF01CO01: 'CANONICAL_GAP',
      EF01CO02: 'CANONICAL_GAP',
      EF01CO03: 'CANONICAL_GAP',
      EF01CO04: 'CANONICAL_GAP',
      EF01CO05: 'CANONICAL_GAP',
      EF01CO06: 'CANONICAL_GAP',
      EF01CO07: 'CANONICAL_GAP',
      EF02CO01: 'CANONICAL_GAP',
      EF02CO02: 'CANONICAL_GAP',
      EF02CO03: 'CANONICAL_GAP',
      EF02CO04: 'CANONICAL_GAP',
      EF02CO05: 'CANONICAL_GAP',
      EF02CO06: 'CANONICAL_GAP',
      EF03CO01: 'CANONICAL_GAP',
      EF03CO02: 'CANONICAL_GAP',
      EF03CO03: 'CANONICAL_GAP',
      EF03CO04: 'CANONICAL_GAP',
      EF03CO05: 'CANONICAL_GAP',
      EF03CO06: 'CANONICAL_GAP',
      EF03CO07: 'CANONICAL_GAP',
      EF03CO08: 'CANONICAL_GAP',
      EF03CO09: 'CANONICAL_GAP',
    };
    for (const [code, mappingStatus] of Object.entries(expected)) {
      const record = sourceVerification.records.find((item) => item.officialCode === code);
      expect(record).toMatchObject({
        technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
        mappingStatus,
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      });
      const officialPage = code.startsWith('EF09CO')
        ? Number(code.slice(-2)) <= 4 ? 56 : 58
        : code.startsWith('EF01CO') ? Number(code.slice(-2)) <= 5 ? 16 : 18
        : code.startsWith('EF02CO') ? 20
        : code.startsWith('EF03CO') ? Number(code.slice(-2)) <= 3 ? 22 : Number(code.slice(-2)) <= 6 ? 24 : 26
        : code.startsWith('EF09ER') ? 461
        : code.startsWith('EF09GE') ? Number(code.slice(-2)) <= 13 ? 395 : 397
        : code.startsWith('EF09HI') ? Number(code.slice(-2)) <= 16 ? 431 : Number(code.slice(-2)) <= 27 ? 433 : 435
        : code.startsWith('EF09LI') ? Number(code.slice(-2)) <= 9 ? 263 : 265
        : code.startsWith('EF09MA') ? Number(code.slice(-2)) <= 12 ? 319 : 321
        : code.startsWith('EF09CI') ? 352
        : code.startsWith('EF01CI') ? 335
        : code.startsWith('EF02CI') ? 337
        : code.startsWith('EF03CI') ? 339
        : code.startsWith('EF04CI') ? 341
        : code.startsWith('EF05CI') ? 343
        : code.startsWith('EF08') ? 350 : code.startsWith('EF07') ? 348 : 346;
      const pageToken = code.startsWith('EF09CO') || code.startsWith('EF01CO') || code.startsWith('EF02CO') || code.startsWith('EF03CO')
        ? String(officialPage).padStart(3, '0')
        : officialPage;
      expect(record.verificationId).toBe(`BNCC_${code}_MEC_P${pageToken}_V1`);
      expect(record.officialSource.page).toBe(officialPage);
    }

    const pendingAudit = JSON.parse(fs.readFileSync(
      path.resolve(root, 'content/bncc/authoring/pending-coverage-audit-v3.json'),
      'utf8',
    ));
    for (const code of Object.keys(expected).filter((item) => item !== 'EF06CI02')) {
      const auditRecord = pendingAudit.records.find((item) => item.officialCode === code);
      expect(auditRecord).toMatchObject({
        queueStatus: 'MAPPING_REVIEW_REQUIRED',
        exactSourceVerified: true,
        nextAction: 'AUTHOR_CONTENT_AFTER_CANONICAL_REVIEW',
        studentPublicationStatus: 'STAGING_INACTIVE',
        pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
      });
    }
  });
});

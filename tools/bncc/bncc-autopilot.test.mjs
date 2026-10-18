import { describe, expect, it } from 'vitest';

import { buildPack, validatePack } from './build-ef01ci02-authoring-pack.mjs';
import { buildEf01Ci04Pack, validateEf01Ci04Pack } from './build-ef01ci04-authoring-pack.mjs';
import { buildEf01Ci05Pack, validateEf01Ci05Pack } from './build-ef01ci05-authoring-pack.mjs';
import { getAuthoringProducer, listAuthoringProducers } from './bncc-authoring-producers.mjs';
import { createInitialState, parseOptions, selectNextTask, validateExistingPackage } from './bncc-autopilot.mjs';

describe('BNCC autopilot', () => {
  it('parses bounded execution options without enabling unbounded loops', () => {
    expect(parseOptions(['--max-tasks=2', '--max-cycles=4', '--max-seconds=30', '--retry-limit=2'])).toMatchObject({
      maxTasks: 2,
      maxCycles: 4,
      maxSeconds: 30,
      retryLimit: 2,
    });
    expect(parseOptions([]).maxTasks).toBeGreaterThan(1);
  });

  it('builds and validates an inactive, unmapped authoring package', () => {
    const pack = buildPack();
    const generated = validatePack(pack);
    expect(generated.valid).toBe(true);
    expect(pack.sourceContext.relation).toBe('AUTHORING_CONTEXT_ONLY');
    expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    expect(pack.publicationStatus).toBe('STAGING_INACTIVE');
    expect(validateExistingPackage({
      officialCode: 'EF01CI02',
      requirements: { questions: 40 },
    }, pack).valid).toBe(true);
  });

  it('builds the next real science producers without opening publication gates', () => {
    for (const [officialCode, build, validate] of [
      ['EF01CI04', buildEf01Ci04Pack, validateEf01Ci04Pack],
      ['EF01CI05', buildEf01Ci05Pack, validateEf01Ci05Pack],
    ]) {
      const pack = build();
      expect(validate(pack).valid).toBe(true);
      expect(pack.sourceContext.officialCode).toBe(officialCode);
      expect(pack.questions).toHaveLength(40);
      expect(pack.active).toBe(false);
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
    }
    expect(getAuthoringProducer({ officialCode: 'EF01CI04' })?.id).toBe('science-human-diversity-v1');
    expect(getAuthoringProducer({ officialCode: 'EI01CG01' })).toBeNull();
    expect(listAuthoringProducers().map((producer) => producer.officialCode)).toEqual(['EF01CI02', 'EF01CI04', 'EF01CI05']);
  });

  it('resumes partial tasks when a producer can upgrade them and skips brief-only tasks', () => {
    const queue = {
      queueHash: 'queue-hash',
      tasks: [
        { taskId: 'BNCC_EF01CI01', officialCode: 'EF01CI01', state: 'CONTENT_TECHNICALLY_COMPLETE', evidence: { source: 'VERIFIED' } },
        { taskId: 'BNCC_EF01CI02', officialCode: 'EF01CI02', state: 'BLOCKED_CANONICAL_REVIEW', evidence: { source: 'VERIFIED' } },
        { taskId: 'BNCC_EF01CI03', officialCode: 'EF01CI03', state: 'BLOCKED_CANONICAL_REVIEW', evidence: { source: 'VERIFIED' } },
        { taskId: 'BNCC_EF01CI04', officialCode: 'EF01CI04', state: 'BLOCKED_CANONICAL_REVIEW', evidence: { source: 'VERIFIED' } },
      ],
    };
    const state = createInitialState(queue);
    expect(state.metrics.completedTasks).toBe(1);
    state.taskRecords.BNCC_EF01CI02 = { taskId: 'BNCC_EF01CI02', status: 'CONTENT_PARTIAL' };
    expect(selectNextTask(queue, state)?.taskId).toBe('BNCC_EF01CI02');
    state.taskRecords.BNCC_EF01CI03 = { taskId: 'BNCC_EF01CI03', status: 'CONTENT_PARTIAL' };
    state.blockedTasks = [{ taskId: 'BNCC_EF01CI02', reason: 'TEST', attempts: 1 }];
    expect(selectNextTask(queue, state)?.taskId).toBe('BNCC_EF01CI04');
  });
});

import { describe, expect, it } from 'vitest';

import { buildPack, validatePack } from './build-ef01ci02-authoring-pack.mjs';
import { buildEf01Ci04Pack, validateEf01Ci04Pack } from './build-ef01ci04-authoring-pack.mjs';
import { buildEf01Ci05Pack, validateEf01Ci05Pack } from './build-ef01ci05-authoring-pack.mjs';
import { buildPack as buildEf01LpPack, validatePack as validateEf01LpPack, listDefinitions } from './build-ef01lp-real-authoring-packs.mjs';
import { getAuthoringProducer, listAuthoringProducers } from './bncc-authoring-producers.mjs';
import { createInitialState, determineRunStatus, parseOptions, selectNextTask, validateExistingPackage } from './bncc-autopilot.mjs';

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
    expect(listAuthoringProducers().map((producer) => producer.officialCode)).toEqual(['EF01CI02', 'EF01CI04', 'EF01CI05', 'EF01LP03', 'EF01LP04', 'EF01LP05', 'EF01LP06']);
  });

  it('builds the first real Portuguese authoring set without opening publication gates', () => {
    expect(listDefinitions()).toEqual(['EF01LP03', 'EF01LP04', 'EF01LP05', 'EF01LP06']);
    for (const officialCode of listDefinitions()) {
      const pack = buildEf01LpPack(officialCode);
      expect(validateEf01LpPack(pack).valid).toBe(true);
      expect(pack.questions).toHaveLength(40);
      expect(pack.lesson.authenticActivities.length).toBeGreaterThanOrEqual(2);
      expect(pack.active).toBe(false);
      expect(pack.publicationStatus).toBe('STAGING_INACTIVE');
      expect(pack.officialMappingStatus).toBe('NOT_CLAIMED');
      expect(pack.sourceContext.relation).toBe('AUTHORING_CONTEXT_ONLY');
    }
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

  it('does not select a verified task that only has a context brief', () => {
    const queue = {
      tasks: [
        { taskId: 'BNCC_EF01CI03', officialCode: 'EF01CI03', state: 'BLOCKED_CANONICAL_REVIEW', evidence: { source: 'VERIFIED' } },
        { taskId: 'BNCC_EF01LP03', officialCode: 'EF01LP03', state: 'BLOCKED_CANONICAL_REVIEW', evidence: { source: 'VERIFIED' } },
      ],
    };
    const state = { taskRecords: { BNCC_EF01CI03: { taskId: 'BNCC_EF01CI03', status: 'AWAITING_CONTENT_AUTHORING' } }, blockedTasks: [] };
    expect(selectNextTask(queue, state)?.taskId).toBe('BNCC_EF01LP03');
  });

  it('reports resumable budget exhaustion separately from terminal campaign states', () => {
    const task = { taskId: 'BNCC_EF01CO03', state: 'PENDING', evidence: { source: 'VERIFIED' } };
    const queue = { tasks: [task] };
    const state = { metrics: { failedTasks: 0 }, blockedTasks: [] };
    const options = { maxTasks: 1, maxCycles: 8, maxSeconds: 900 };

    expect(determineRunStatus({ queue, state, tasksProcessed: 1, options })).toBe('EXECUTION_BUDGET_REACHED');
    expect(determineRunStatus({ queue: { tasks: [{ ...task, state: 'CONTENT_TECHNICALLY_COMPLETE' }] }, state, options })).toBe('CAMPAIGN_COMPLETE');
    expect(determineRunStatus({ queue, state: { ...state, blockedTasks: [{ taskId: task.taskId }] }, options })).toBe('HUMAN_REVIEW_BLOCKED');
    expect(determineRunStatus({ queue, state: { ...state, metrics: { failedTasks: 1 } }, options })).toBe('VALIDATION_FAILED');
    expect(determineRunStatus({ queue: { tasks: [{ ...task, evidence: { source: 'UNVERIFIED' } }] }, state, options })).toBe('NO_EXECUTABLE_TASKS');
  });
});

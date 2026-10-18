import assert from 'node:assert/strict';
import { it } from 'vitest';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';

const officialSourceRecord = {
  officialCode: 'EF01CI01',
  descriptor: 'Comparar características de materiais e seus usos no cotidiano.',
  technicalVerificationStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
  officialSource: { url: 'https://example.test/bncc.pdf', page: 335 },
};

function objectivePack({ repeatedStatement = false, allAnswersAtFirstPosition = false } = {}) {
  const phases = ['PROBE', 'PRACTICE', 'TRANSFER', 'LOCK_IN', 'REVIEW'];
  const questions = Array.from({ length: 8 }, (_, index) => {
    const options = ['A', 'B', 'C', 'D'];
    const answerPosition = allAnswersAtFirstPosition ? 0 : index % 4;
    return {
      id: `q-${index}`,
      purpose: phases[index % phases.length],
      statement: repeatedStatement ? 'Repeated prompt for this test.' : `Distinct supported prompt ${index}.`,
      options,
      correctAnswer: options[answerPosition],
      explanation: 'A concise explanation tied to the evidence in the prompt.',
      hint: 'Look at the material property.',
      errorFocus: 'Confusing observation with inference.',
    };
  });
  return {
    active: false,
    publicationStatus: 'STAGING_INACTIVE',
    pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING',
    officialMappingStatus: 'NOT_CLAIMED',
    sourceContext: {
      officialCode: officialSourceRecord.officialCode,
      descriptor: officialSourceRecord.descriptor,
      sourceStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
      officialSource: officialSourceRecord.officialSource,
    },
    questions,
    lesson: {
      objective: 'Compare material properties and support a choice with evidence.',
      explanation: 'A sufficiently detailed explanation that develops the concept step by step and ties observations to a supported conclusion.',
      workedExample: 'Compare two containers and explain how one observed property relates to their use.',
      commonMistake: 'Assuming appearance alone proves a material has a particular origin.',
      keyConcepts: ['observation', 'property', 'use'],
      priorKnowledge: ['Describe visible features of familiar objects.'],
      progression: phases.map((phase) => ({ phase, questionIds: questions.filter((question) => question.purpose === phase).map((question) => question.id) })),
      authenticActivities: [{
        steps: ['Select two safe objects.', 'Observe one property of each.', 'Record a comparison and evidence.'],
        evidence: 'A recorded comparison linked to a visible property.',
        rubric: ['Identifies an observable property.', 'Supports a comparison with evidence.'],
      }],
      remediations: [
        { errorFocus: 'Treating an inference as a direct observation.', action: 'Return to the object and name one visible feature before drawing a conclusion.' },
        { errorFocus: 'Choosing a use without considering a property.', action: 'Compare the material feature with the purpose of each object.' },
      ],
      accessibilitySupports: ['Provide high-contrast object images and spoken descriptions.', 'Allow oral, drawn, or written responses.'],
    },
  };
}

it('objective-learning rubric reports preparation separately from human approval', () => {
  const rubric = evaluateCurriculumPackageRubric(objectivePack(), {
    requirements: { mode: 'OBJECTIVE_LEARNING_PATH', questions: 8, activities: 1 },
    officialSourceRecord,
  });
  assert.equal(rubric.status, 'AUTOMATED_SCREEN_PASS');
  assert.equal(rubric.structuralValidationStatus, 'STRUCTURAL_VALIDATION_PASS');
  assert.equal(rubric.automatedQualityScreenStatus, 'AUTOMATED_QUALITY_SCREEN_PASS');
  assert.equal(rubric.contentTechnicalPreparationStatus, 'CONTENT_TECHNICALLY_PREPARED');
  assert.equal(rubric.humanPedagogicalApprovalStatus, 'HUMAN_PEDAGOGICAL_REVIEW_PENDING');
  assert.equal(rubric.humanReview.automatedApprovalClaimed, false);
});

it('question variety rejects duplicate stems and answer-position collapse', () => {
  const duplicate = evaluateCurriculumPackageRubric(objectivePack({ repeatedStatement: true }), {
    requirements: { mode: 'OBJECTIVE_LEARNING_PATH', questions: 8, activities: 1 },
    officialSourceRecord,
  });
  assert.ok(duplicate.incomplete.includes('question-statement-diversity'));

  const collapsed = evaluateCurriculumPackageRubric(objectivePack({ allAnswersAtFirstPosition: true }), {
    requirements: { mode: 'OBJECTIVE_LEARNING_PATH', questions: 8, activities: 1 },
    officialSourceRecord,
  });
  assert.ok(collapsed.incomplete.includes('answer-position-diversity'));
});

it('practical performance mode can pass with no multiple-choice questions', () => {
  const pack = objectivePack();
  pack.questions = [];
  pack.lesson.progression = [];
  const rubric = evaluateCurriculumPackageRubric(pack, {
    requirements: { mode: 'PRACTICAL_PERFORMANCE', questions: 0, concepts: 2, activities: 1, phases: [] },
    officialSourceRecord,
  });
  assert.equal(rubric.status, 'AUTOMATED_SCREEN_PASS');
  assert.equal(rubric.mode, 'PRACTICAL_PERFORMANCE');
});

it('educator-mediated observation uses observation evidence, not a quiz contract', () => {
  const pack = {
    active: false,
    officialCode: 'EI01CG04',
    descriptor: 'Participar de uma rotina de cuidado respeitosa.',
    sourceStatus: 'OFFICIAL_SOURCE_VERIFIED_EXACT',
    officialSource: { url: 'https://example.test/bncc.pdf', page: 49 },
    evidenceMode: 'EDUCATOR_MEDIATED_OBSERVATION',
    learningDesign: {
      objective: 'Participar da rotina de cuidado em formas respeitosas e observáveis.',
      observationExperiences: [
        { title: 'Antecipar uma etapa', steps: ['Avisar.', 'Aguardar um sinal.', 'Responder ao sinal.'], observableEvidence: 'A criança comunica conforto, pausa ou participação por meio próprio.' },
        { title: 'Escolher um objeto', steps: ['Oferecer duas opções.', 'Aguardar escolha ou recusa.', 'Registrar o apoio necessário.'], observableEvidence: 'A criança indica escolha, recusa, interesse ou necessidade de apoio.' },
      ],
      observationCriteria: ['Forma de participação observada.', 'Sinal de conforto ou pausa percebido.', 'Resposta do educador registrada.', 'Escolha ou recusa respeitada.', 'Privacidade e segurança preservadas.'],
      evidenceRecord: { requiredFields: ['date', 'context', 'observation', 'response'], privacy: 'Preservar a privacidade, registrar apenas o necessário e não registrar imagens íntimas.' },
      adaptations: ['Antecipar com fala, gesto ou objeto de referência conforme a comunicação da criança.', 'Ajustar ruído, posição e ritmo e aceitar pausas.'],
    },
    contentStatus: { publicationStatus: 'STAGING_INACTIVE', pedagogicalReviewStatus: 'PEDAGOGICAL_REVIEW_PENDING', officialMappingStatus: 'NOT_CLAIMED', studentQuiz: 'NOT_CREATED', humanApproval: 'NOT_GRANTED' },
  };
  const source = { ...officialSourceRecord, officialCode: pack.officialCode, descriptor: pack.descriptor, officialSource: pack.officialSource };
  const rubric = evaluateCurriculumPackageRubric(pack, {
    requirements: { mode: 'EDUCATOR_MEDIATED_OBSERVATION', observationalExperiences: 2, observationCriteria: 5, questions: 0 },
    officialSourceRecord: source,
  });
  assert.equal(rubric.status, 'AUTOMATED_SCREEN_PASS');
  assert.equal(rubric.mode, 'EDUCATOR_MEDIATED_OBSERVATION');
  assert.equal(rubric.checks.some((check) => check.id.includes('question')), false);
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCurriculumPackageRubric } from './curriculum-package-rubric.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AUTHORING_DIR = 'content/bncc/authoring';
const SOURCE_PATH = 'content/bncc/authoring/source-verification-v2.json';
const REPORT_PATH = 'content/bncc/authoring/early-childhood-observation-review-v1.json';

const RECIPES = {
  EI01CG01: {
    file: 'early-childhood-experiential-v1.json',
    experiences: [
      { title: 'Canção com movimento e pausa', steps: ['Escolha uma canção curta e conhecida e deixe o bebê em posição segura.', 'Acompanhe o ritmo com movimentos suaves, sem exigir imitação, e faça pausas para perceber sinais.', 'Responda a movimentos, vocalizações, aproximação, recusa ou ausência de resposta sem atribuir uma intenção única.'], observableEvidence: 'Registro descritivo do movimento ou sinal observado, da pausa oferecida e da resposta do adulto, sem interpretar a intenção além do observável.' },
      { title: 'Exploração de objeto seguro', steps: ['Disponibilize um objeto íntegro e apropriado à faixa etária em distância segura.', 'Aguarde se o bebê olha, alcança, toca, recusa ou solicita continuidade por seu modo de comunicação.', 'Ajuste distância, posição ou estímulos e encerre ou retome conforme sinais de interesse e conforto.'], observableEvidence: 'Descrição da forma de aproximação, recusa, pausa ou retomada e do apoio oferecido pelo adulto.' },
    ],
    additionalCriterion: 'O registro descreve movimento ou sinal observável sem afirmar uma intenção que não foi comunicada.',
  },
  EI02CG01: {
    file: 'early-childhood-experiential-v2.json',
    experiences: [
      { title: 'Brincadeira cultural escolhida pelo grupo', steps: ['Apresente uma brincadeira conhecida com breve contexto de origem ou uso, sem exigir que todas as crianças a conheçam.', 'Convide a observar, experimentar, variar ou propor um gesto, com alternativas de participação.', 'Registre escolhas e adaptações sem corrigir diferenças culturais como se houvesse uma única forma correta.'], observableEvidence: 'Descrição de gesto ou movimento escolhido, transformado ou observado e da forma como as referências culturais foram acolhidas.' },
      { title: 'Cuidado cotidiano em brincadeira simbólica', steps: ['Disponibilize objetos seguros para uma situação de cuidado simbólico, como guardar objetos ou cuidar de uma boneca.', 'Convide a criança a escolher materiais e gestos, podendo observar, participar, alterar ou parar.', 'Reconheça a ação sem impor uma sequência padronizada e ofereça apoio de comunicação quando solicitado.'], observableEvidence: 'Registro da escolha de objetos, gesto ou sequência e do modo como a autonomia e a participação foram respeitadas.' },
    ],
    additionalCriterion: 'A criança pode observar, variar ou recusar a prática cultural sem perder o acolhimento ou a possibilidade de participação.',
  },
  EI03CG01: {
    file: 'early-childhood-experiential-v3.json',
    experiences: [
      { title: 'Criar movimentos para uma música', steps: ['Convide a escolher, ouvir ou observar uma música e ofereça espaço e materiais seguros.', 'Disponibilize tempo para criar, combinar ou transformar gestos sem solicitar apresentação pública.', 'Aceite participação por movimento, fala, olhar, comunicação alternativa, observação ou recusa.'], observableEvidence: 'Descrição da forma de expressão escolhida pela criança e das opções de participação oferecidas, sem interpretar a emoção por ela.' },
      { title: 'Transformar uma cena ou história', steps: ['Apresente uma história ou situação cotidiana e materiais cênicos seguros.', 'Convide a representar, transformar ou apenas observar a cena por uma forma de comunicação escolhida.', 'Pergunte se a criança deseja registrar ou comentar sua criação e respeite a opção de não explicar.'], observableEvidence: 'Registro da criação ou transformação e da forma como a criança escolheu participar, sem atribuir significado não comunicado.' },
    ],
    additionalCriterion: 'A criança escolhe se deseja compartilhar a expressão e não recebe uma interpretação adulta como significado obrigatório.',
  },
  EI01CG02: {
    file: 'early-childhood-experiential-v4.json',
    experiences: [
      { title: 'Explorar objeto ao alcance seguro', steps: ['Organize superfície estável e posição segura conforme orientação da equipe.', 'Disponibilize um objeto grande, íntegro e adequado, deixando a criança olhar, tocar, alcançar ou recusar.', 'Ajuste a distância ou interrompa a proposta diante de sinais de cansaço ou desconforto.'], observableEvidence: 'Descrição dos movimentos, olhares, pausas e ajustes de apoio, sem tratar deslocamento como requisito de êxito.' },
      { title: 'Alternar gesto, canção e pausa', steps: ['Apresente uma canção curta com gesto lento e previsível.', 'Alterne movimento e pausa para que o bebê acompanhe, observe, interrompa ou retome.', 'Responda aos sinais de interesse e pare quando houver desconforto ou necessidade de descanso.'], observableEvidence: 'Registro da participação voluntária, variação ou pausa e da resposta responsiva do adulto.' },
    ],
    additionalCriterion: 'A exploração pode ocorrer por olhar, toque, movimento parcial, pausa ou observação, sem exigência de deslocamento.',
  },
  EI01CG03: {
    file: 'early-childhood-experiential-v5.json',
    experiences: [
      { title: 'Imitação em interação recíproca', steps: ['Realize um gesto simples e visualmente acessível e aguarde sem repetir de forma insistente.', 'Observe se o bebê repete, transforma, inicia outro gesto, vocaliza ou prefere observar.', 'Responda à iniciativa e permita encerrar a interação a qualquer momento.'], observableEvidence: 'Descrição da resposta observável e da alternância entre iniciativa, pausa e resposta do adulto.' },
      { title: 'Movimento de personagem em história', steps: ['Apresente um fantoche ou imagem de animal em uma história breve, sem sons intensos.', 'Demonstre um movimento e deixe disponível a opção de olhar, tocar, vocalizar, imitar ou variar.', 'Afaste o material ou reduza estímulos se houver desconforto e retome somente com sinal de interesse.'], observableEvidence: 'Registro de como a criança acompanhou ou respondeu ao movimento, incluindo adaptações e sinais de pausa.' },
    ],
    additionalCriterion: 'Imitar, transformar, responder de outro modo ou apenas observar são possibilidades válidas, sem ranking de desempenho.',
  },
  EI01CG04: {
    file: 'early-childhood-experiential-v6.json',
    experiences: [
      { title: 'Antecipar uma etapa do cuidado', steps: ['Avise a próxima etapa com fala, gesto ou objeto de referência antes de iniciar, sempre que for seguro.', 'Aguarde sinais de conforto, interesse, pausa ou recusa e ajuste o ritmo e a posição.', 'Registre somente a participação observada e a resposta do adulto, sem imagens de momentos íntimos.'], observableEvidence: 'Registro mínimo da etapa antecipada, da forma observável de participação ou pausa e do apoio responsivo oferecido, sem inferir independência.' },
      { title: 'Oferecer escolha simples durante a rotina', steps: ['Disponibilize duas opções seguras relacionadas à rotina, quando isso não comprometer o cuidado essencial.', 'Aguarde uma escolha, recusa ou sinal de pausa pelo modo de comunicação do bebê.', 'Respeite a resposta, mantenha privacidade e retome a rotina com apoio adequado, sem forçar autonomia.'], observableEvidence: 'Descrição da escolha ou recusa observada e do ajuste realizado, sem registrar imagens ou detalhes desnecessários do cuidado.' },
    ],
    additionalCriterion: 'A recusa, a pausa ou a participação parcial são respeitadas sem forçar autonomia nem comprometer a segurança do cuidado.',
  },
  EI01EF01: {
    file: 'early-childhood-experiential-v7.json',
    experiences: [
      { title: 'Chamada breve em uma rotina acolhedora', steps: ['Use o nome pelo qual a família autorizou chamar o bebê, em uma interação cotidiana calma e sem exposição pública.', 'Chame uma vez em voz natural e aguarde; observe orientação do olhar, movimento, vocalização, pausa ou outra resposta sem exigir fala.', 'Interrompa se houver desconforto e registre somente a resposta observável, sem repetir chamadas para testar a criança.'], observableEvidence: 'Descrição mínima do contexto, do chamado uma vez, da resposta observável e do apoio oferecido, sem afirmar reconhecimento além das evidências.' },
      { title: 'Livro de convivência com nomes familiares autorizados', steps: ['Leia um livro curto com personagens e, somente se autorizado, use nomes familiares fornecidos por responsáveis em contexto privado.', 'Ao mencionar um nome, faça uma pausa natural para permitir olhar, gesto, vocalização, comunicação alternativa ou ausência de resposta.', 'Não peça que o bebê repita, aponte ou demonstre desempenho; acolha qualquer forma de participação e encerre conforme seus sinais.'], observableEvidence: 'Registro sem nomes: indica que houve leitura compartilhada, quais respostas observáveis ocorreram e como a privacidade e o ritmo foram preservados.' },
    ],
    additionalCriterion: 'O adulto usa nomes autorizados em contexto privado, não exige resposta verbal nem repete chamadas para testar reconhecimento.',
  },
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function completeEarlyChildhoodObservationPackages({ checkOnly = false } = {}) {
  const sourceVerification = readJson(SOURCE_PATH);
  const sourceByCode = new Map((sourceVerification.records ?? []).map((record) => [record.officialCode, record]));
  const previousReport = fs.existsSync(path.join(ROOT, REPORT_PATH)) ? readJson(REPORT_PATH) : null;
  const previousByCode = new Map((previousReport?.packages ?? []).map((item) => [item.officialCode, item]));
  const report = {
    schemaVersion: 'tec-escola.bncc.early-childhood-observation-review.v1',
    campaign: 'TECESCOLA_BNCC_AUTOPILOT_RECOVERY_AND_SCALE',
    snapshotDate: previousReport?.snapshotDate ?? new Date().toISOString().slice(0, 10),
    rubricVersion: 'tec-escola.bncc.technical-completeness.v2',
    quizRequired: false,
    humanApprovalGranted: false,
    publicationAuthorized: false,
    packages: [],
  };

  for (const [code, recipe] of Object.entries(RECIPES)) {
    const relativePath = `${AUTHORING_DIR}/${recipe.file}`;
    const pack = readJson(relativePath);
    const source = sourceByCode.get(code);
    if (!source || source.technicalVerificationStatus !== 'OFFICIAL_SOURCE_VERIFIED_EXACT') throw new Error(`${code}_EXACT_OFFICIAL_SOURCE_REQUIRED`);
    const requirements = { mode: 'EDUCATOR_MEDIATED_OBSERVATION', observationalExperiences: 2, observationCriteria: 5, questions: 0 };
    const before = evaluateCurriculumPackageRubric(pack, { requirements, officialSourceRecord: source });
    pack.active = false;
    pack.learningDesign.observationExperiences = recipe.experiences;
    if (!pack.learningDesign.observationCriteria.includes(recipe.additionalCriterion)) pack.learningDesign.observationCriteria.push(recipe.additionalCriterion);
    const after = evaluateCurriculumPackageRubric(pack, { requirements, officialSourceRecord: source });
    if (!checkOnly) writeJson(relativePath, pack);
    report.packages.push({
      officialCode: code,
      file: relativePath,
      status: after.status,
      beforeIncompleteChecks: previousByCode.get(code)?.beforeIncompleteChecks ?? before.incomplete,
      afterIncompleteChecks: after.incomplete,
      observationExperiences: pack.learningDesign.observationExperiences.length,
      observationCriteria: pack.learningDesign.observationCriteria.length,
      quizRequired: false,
      active: pack.active,
      publicationStatus: pack.contentStatus.publicationStatus,
      humanPedagogicalReviewStatus: after.humanPedagogicalApprovalStatus,
    });
    console.log(`${code} ${checkOnly ? 'CHECKED' : 'COMPLETED'} ${after.status} remaining=${after.incomplete.join(',') || 'none'} experiences=${pack.learningDesign.observationExperiences.length} questions=0`);
  }

  report.packages.sort((left, right) => left.officialCode.localeCompare(right.officialCode));
  if (!checkOnly) writeJson(REPORT_PATH, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  completeEarlyChildhoodObservationPackages({ checkOnly: process.argv.includes('--check') });
}

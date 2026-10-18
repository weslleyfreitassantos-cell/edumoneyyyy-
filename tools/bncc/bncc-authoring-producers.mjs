import { buildPack as buildEf01Ci02Pack, validatePack as validateEf01Ci02Pack } from './build-ef01ci02-authoring-pack.mjs';
import { buildEf01Ci04Pack, validateEf01Ci04Pack } from './build-ef01ci04-authoring-pack.mjs';
import { buildEf01Ci05Pack, validateEf01Ci05Pack } from './build-ef01ci05-authoring-pack.mjs';

const PRODUCERS = new Map([
  ['EF01CI02', {
    id: 'science-body-functions-v1',
    path: 'content/adaptive/tec-escola-core-v5/v1-science-body-parts-fi.json',
    build: buildEf01Ci02Pack,
    validate: validateEf01Ci02Pack,
  }],
  ['EF01CI04', {
    id: 'science-human-diversity-v1',
    path: 'content/adaptive/tec-escola-core-v5/v1-science-human-diversity-fi.json',
    build: buildEf01Ci04Pack,
    validate: validateEf01Ci04Pack,
  }],
  ['EF01CI05', {
    id: 'science-time-scales-v1',
    path: 'content/adaptive/tec-escola-core-v5/v1-science-time-scales-fi.json',
    build: buildEf01Ci05Pack,
    validate: validateEf01Ci05Pack,
  }],
]);

export function getAuthoringProducer(task) {
  return task?.officialCode ? PRODUCERS.get(task.officialCode) ?? null : null;
}

export function listAuthoringProducers() {
  return [...PRODUCERS.entries()].map(([officialCode, producer]) => ({ officialCode, id: producer.id, path: producer.path }));
}

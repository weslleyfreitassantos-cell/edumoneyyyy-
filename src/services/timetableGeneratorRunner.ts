import {
  generateTimetable,
  type TimetableGeneratorInput,
  type TimetableGeneratorResult,
} from '../lib/academic/timetableGenerator';

interface WorkerSuccessMessage {
  type: 'success';
  result: TimetableGeneratorResult;
}

interface WorkerErrorMessage {
  type: 'error';
  message: string;
}

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage;

function runInWorker(input: TimetableGeneratorInput): Promise<TimetableGeneratorResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/timetableGenerator.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      worker.terminate();
      if (event.data.type === 'success') {
        resolve(event.data.result);
        return;
      }
      reject(new Error(event.data.message));
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Não foi possível executar a geração da grade.'));
    };

    worker.postMessage(input);
  });
}

export function runTimetableGenerator(
  input: TimetableGeneratorInput,
): Promise<TimetableGeneratorResult> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve().then(() => generateTimetable(input));
  }

  return runInWorker(input);
}

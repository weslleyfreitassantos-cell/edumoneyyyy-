import {
  generateTimetable,
  type TimetableGeneratorInput,
} from '../lib/academic/timetableGenerator';

type WorkerMessage =
  | { type: 'success'; result: ReturnType<typeof generateTimetable> }
  | { type: 'error'; message: string };

const workerScope = globalThis as unknown as {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<TimetableGeneratorInput>) => void,
  ) => void;
  postMessage: (message: WorkerMessage) => void;
};

workerScope.addEventListener('message', (event) => {
  try {
    workerScope.postMessage({
      type: 'success',
      result: generateTimetable(event.data),
    });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Falha ao gerar a grade.',
    });
  }
});

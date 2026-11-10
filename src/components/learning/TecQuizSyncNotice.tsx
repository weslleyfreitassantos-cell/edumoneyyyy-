import { LoaderCircle, RefreshCw } from 'lucide-react';

type TecQuizSyncNoticeProps = {
  failedAttempts: number;
  isRetrying: boolean;
  maxAttempts: number;
  onRetry: () => void;
};

export default function TecQuizSyncNotice({
  failedAttempts,
  isRetrying,
  maxAttempts,
  onRetry,
}: TecQuizSyncNoticeProps) {
  if (failedAttempts === 0) return null;

  return (
    <div
      role={isRetrying ? 'status' : 'alert'}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <p>
        {isRetrying
          ? `A partida está sincronizando novamente (${failedAttempts}/${maxAttempts}).`
          : 'A sincronização automática parou após várias tentativas.'}
      </p>
      {isRetrying ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 font-semibold underline underline-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar sincronizar agora
        </button>
      )}
    </div>
  );
}

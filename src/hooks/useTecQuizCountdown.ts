import { useEffect, useMemo, useState } from 'react';

export function useTecQuizCountdown(
  deadline: string | null | undefined,
  serverNow?: string | null,
  pausedAt?: string | null,
) {
  const [clientNow, setClientNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClientNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const serverTimestamp = serverNow ? Date.parse(serverNow) : Number.NaN;
  const clientServerOffset = useMemo(
    () => Number.isFinite(serverTimestamp) ? Date.now() - serverTimestamp : 0,
    [serverTimestamp],
  );

  if (!deadline) return null;
  const deadlineTimestamp = Date.parse(deadline);
  const pausedTimestamp = pausedAt ? Date.parse(pausedAt) : Number.NaN;
  const effectiveNow = Number.isFinite(pausedTimestamp)
    ? pausedTimestamp
    : Number.isFinite(serverTimestamp)
      ? clientNow - clientServerOffset
      : clientNow;

  if (!Number.isFinite(deadlineTimestamp) || !Number.isFinite(effectiveNow)) return null;
  return Math.max(0, Math.ceil((deadlineTimestamp - effectiveNow) / 1000));
}

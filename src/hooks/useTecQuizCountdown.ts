import { useEffect, useMemo, useState } from 'react';

export function useTecQuizCountdown(
  deadline: string | null | undefined,
  serverNow?: string | null,
  pausedAt?: string | null,
) {
  const [monotonicNow, setMonotonicNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setMonotonicNow(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const serverTimestamp = serverNow ? Date.parse(serverNow) : Number.NaN;
  const serverClockAnchor = useMemo(
    () => Number.isFinite(serverTimestamp)
      ? { serverTimestamp, monotonicTimestamp: performance.now() }
      : null,
    [serverTimestamp],
  );

  if (!deadline) return null;
  const deadlineTimestamp = Date.parse(deadline);
  const pausedTimestamp = pausedAt ? Date.parse(pausedAt) : Number.NaN;
  if (!serverClockAnchor) return null;
  const effectiveNow = Number.isFinite(pausedTimestamp)
    ? pausedTimestamp
    : serverClockAnchor.serverTimestamp + (monotonicNow - serverClockAnchor.monotonicTimestamp);

  if (!Number.isFinite(deadlineTimestamp) || !Number.isFinite(effectiveNow)) return null;
  return Math.max(0, Math.ceil((deadlineTimestamp - effectiveNow) / 1000));
}

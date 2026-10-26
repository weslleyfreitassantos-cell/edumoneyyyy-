import { useCallback, useSyncExternalStore } from 'react';

import { psychologyService } from '../services/psychologyService';

export type PsychologyModuleState = 'loading' | 'enabled' | 'disabled' | 'unknown';

export interface PsychologyModuleSnapshot {
  state: PsychologyModuleState;
  canManage: boolean | null;
}

const loadingSnapshot: PsychologyModuleSnapshot = Object.freeze({
  state: 'loading',
  canManage: null,
});
const refreshIntervalMs = 8_000;
const storageEventKey = 'edumanager.psychology.module.changed';

interface Entry {
  institutionId: string;
  profileId: string;
  role: string;
  snapshot: PsychologyModuleSnapshot;
  listeners: Set<() => void>;
  timer: number | null;
  request: Promise<void> | null;
}

const entries = new Map<string, Entry>();
let broadcast: BroadcastChannel | null = null;
let globalListenersAttached = false;

function entryKey(institutionId: string, profileId: string, role: string): string {
  return `${institutionId}:${profileId}:${role}`;
}

function notify(entry: Entry): void {
  entry.listeners.forEach((listener) => listener());
}

function matchingEntries(institutionId: string): Entry[] {
  return [...entries.values()].filter((entry) => entry.institutionId === institutionId);
}

function refreshEntry(entry: Entry): Promise<void> {
  if (entry.request) return entry.request;

  entry.request = (async () => {
    const managerRole = ['ADMIN', 'DIRECTOR', 'SECRETARY'].includes(entry.role);
    const [enabledResult, managerResult] = await Promise.allSettled([
      psychologyService.moduleEnabled(entry.institutionId),
      managerRole ? psychologyService.canManageModule(entry.institutionId) : Promise.resolve(false),
    ]);

    const state: PsychologyModuleState = enabledResult.status === 'fulfilled'
      ? (enabledResult.value ? 'enabled' : 'disabled')
      : 'unknown';
    const canManage = managerResult.status === 'fulfilled' ? managerResult.value : false;
    if (entry.snapshot.state !== state || entry.snapshot.canManage !== canManage) {
      entry.snapshot = { state, canManage };
      notify(entry);
    }
  })().finally(() => {
    entry.request = null;
  });

  return entry.request;
}

function refreshInstitution(institutionId: string): void {
  matchingEntries(institutionId).forEach((entry) => { void refreshEntry(entry); });
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    entries.forEach((entry) => { void refreshEntry(entry); });
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== storageEventKey || !event.newValue) return;
  try {
    const changed = JSON.parse(event.newValue) as { institutionId?: string };
    if (changed.institutionId) refreshInstitution(changed.institutionId);
  } catch {
    // The event carries only an invalidation hint; a malformed hint is ignored.
  }
}

function handleBroadcast(event: MessageEvent<unknown>): void {
  if (!event.data || typeof event.data !== 'object') return;
  const changed = event.data as { type?: string; institutionId?: string };
  if (changed.type === 'psychology-module-changed' && changed.institutionId) {
    refreshInstitution(changed.institutionId);
  }
}

function attachGlobalListeners(): void {
  if (globalListenersAttached || typeof window === 'undefined') return;
  globalListenersAttached = true;
  window.addEventListener('focus', handleVisibilityChange);
  window.addEventListener('storage', handleStorage);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  if ('BroadcastChannel' in window) {
    broadcast = new BroadcastChannel('edumanager-psychology-module');
    broadcast.addEventListener('message', handleBroadcast);
  }
}

function detachGlobalListeners(): void {
  if (!globalListenersAttached || entries.size > 0 || typeof window === 'undefined') return;
  globalListenersAttached = false;
  window.removeEventListener('focus', handleVisibilityChange);
  window.removeEventListener('storage', handleStorage);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  broadcast?.removeEventListener('message', handleBroadcast);
  broadcast?.close();
  broadcast = null;
}

function getEntry(institutionId: string, profileId: string, role: string): Entry {
  const key = entryKey(institutionId, profileId, role);
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      institutionId,
      profileId,
      role,
      snapshot: loadingSnapshot,
      listeners: new Set(),
      timer: null,
      request: null,
    };
    entries.set(key, entry);
  }
  return entry;
}

function subscribe(
  institutionId: string,
  profileId: string,
  role: string,
  listener: () => void,
): () => void {
  if (!institutionId || !profileId) return () => undefined;
  const entry = getEntry(institutionId, profileId, role);
  entry.listeners.add(listener);
  attachGlobalListeners();
  void refreshEntry(entry);
  if (entry.timer === null) {
    entry.timer = window.setInterval(() => { void refreshEntry(entry); }, refreshIntervalMs);
  }

  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      if (entry.timer !== null) window.clearInterval(entry.timer);
      entries.delete(entryKey(institutionId, profileId, role));
      detachGlobalListeners();
    }
  };
}

export function usePsychologyModuleStatus(
  institutionId: string | null,
  profileId: string | null,
  role: string,
): PsychologyModuleSnapshot {
  const key = institutionId && profileId ? entryKey(institutionId, profileId, role) : '';
  const subscribeToStore = useCallback((listener: () => void) => {
    if (!institutionId || !profileId) return () => undefined;
    return subscribe(institutionId, profileId, role, listener);
  }, [institutionId, profileId, role]);
  const getSnapshot = useCallback(() => key ? entries.get(key)?.snapshot ?? loadingSnapshot : loadingSnapshot, [key]);
  return useSyncExternalStore(subscribeToStore, getSnapshot, () => loadingSnapshot);
}

export function publishPsychologyModuleStatusChanged(
  institutionId: string,
  enabled: boolean,
): void {
  matchingEntries(institutionId).forEach((entry) => {
    entry.snapshot = { ...entry.snapshot, state: enabled ? 'enabled' : 'disabled' };
    notify(entry);
  });

  const message = { type: 'psychology-module-changed', institutionId };
  broadcast?.postMessage(message);
  try {
    window.localStorage.setItem(storageEventKey, JSON.stringify({ ...message, at: Date.now() }));
  } catch {
    // Cross-tab storage notifications are best effort; active clients also revalidate on focus.
  }
}

export function refreshPsychologyModuleStatus(institutionId: string): void {
  refreshInstitution(institutionId);
}


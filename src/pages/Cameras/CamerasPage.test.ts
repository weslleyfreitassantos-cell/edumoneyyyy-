import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearNewCameraDraft,
  hasNewCameraDraft,
  initialCameraForm,
  readNewCameraDraft,
  writeNewCameraDraft,
} from './cameraForm';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CamerasPage', () => {
  it('inclui a instituição ativa ao iniciar o cadastro de uma câmera', () => {
    const form = initialCameraForm(null, 'institution-1', 'gateway-1', []);

    expect(form.institutionId).toBe('institution-1');
    expect(form.gatewayId).toBe('gateway-1');
  });

  it('preserva e limpa o rascunho da nova câmera na sessão', () => {
    const values = new Map<string, string>();

    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    const draft = initialCameraForm(null, 'institution-1', 'gateway-1', []);
    draft.name = 'Entrada principal';
    draft.host = '192.168.1.50';

    writeNewCameraDraft('institution-1', draft);

    expect(hasNewCameraDraft('institution-1')).toBe(true);
    expect(readNewCameraDraft('institution-1')).toEqual(draft);

    clearNewCameraDraft('institution-1');

    expect(hasNewCameraDraft('institution-1')).toBe(false);
    expect(readNewCameraDraft('institution-1')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { initialCameraForm } from './cameraForm';

describe('CamerasPage', () => {
  it('inclui a instituição ativa ao iniciar o cadastro de uma câmera', () => {
    const form = initialCameraForm(null, 'institution-1', 'gateway-1', []);

    expect(form.institutionId).toBe('institution-1');
    expect(form.gatewayId).toBe('gateway-1');
  });
});

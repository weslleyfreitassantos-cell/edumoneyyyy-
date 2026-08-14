import { describe, expect, it } from 'vitest';

import { isSafeCameraHost, validateCameraInput } from './cameraValidation';

describe('cameraValidation', () => {
  it('aceita IP privado e hostname para o gateway local', () => {
    expect(isSafeCameraHost('192.168.1.50')).toBe(true);
    expect(isSafeCameraHost('nvr.escola.local')).toBe(true);
  });

  it('aceita hosts locais e rejeita URLs e endpoints inseguros', () => {
    expect(isSafeCameraHost('rtsp://192.168.1.50/live')).toBe(false);
    expect(isSafeCameraHost('127.0.0.1')).toBe(true);
    expect(isSafeCameraHost('localhost')).toBe(true);
    expect(isSafeCameraHost('::1')).toBe(true);
    expect(isSafeCameraHost('169.254.169.254')).toBe(false);
    expect(isSafeCameraHost('0.0.0.0')).toBe(false);
  });

  it('permite cadastrar câmera no host local do gateway', () => {
    expect(validateCameraInput({ name: 'Entrada', host: '127.0.0.1', port: 8554, deviceType: 'IP_CAMERA', channel: null })).toBeNull();
  });

  it('exige canal quando o dispositivo é NVR', () => {
    expect(validateCameraInput({ name: 'Entrada', host: '192.168.1.50', port: 554, deviceType: 'NVR', channel: null })).toMatch(/canal/i);
    expect(validateCameraInput({ name: 'Entrada', host: '192.168.1.50', port: 554, deviceType: 'NVR', channel: 1 })).toBeNull();
  });
});

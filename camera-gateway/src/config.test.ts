import { describe, expect, it } from 'vitest';

import { listenHostForLocalBaseUrl, validateLocalBaseUrl, validateMediaMtxRtspUrl, validateRelayBaseUrl } from './config.ts';

describe('gateway local URL', () => {
  it('aceita loopback e LAN privada', () => {
    expect(validateLocalBaseUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
    expect(listenHostForLocalBaseUrl('http://192.168.1.108:8787')).toBe('0.0.0.0');
  });

  it('rejeita host publico e credencial embutida', () => {
    expect(() => validateLocalBaseUrl('https://example.com:8787')).toThrow(/rede privada/i);
    expect(() => validateLocalBaseUrl('http://user:pass@192.168.1.108:8787')).toThrow(/credenciais/i);
  });

  it('aceita a raiz RTSP do MediaMTX sem barra final', () => {
    expect(validateMediaMtxRtspUrl('rtsp://127.0.0.1:8554')).toBe('rtsp://127.0.0.1:8554');
  });

  it('aceita somente hostname HTTPS do relay controlado', () => {
    expect(validateRelayBaseUrl('https://camera-gw-0123456789abcdef.grupotec.dev.br/')).toBe('https://camera-gw-0123456789abcdef.grupotec.dev.br');
    expect(() => validateRelayBaseUrl('http://camera-gw-0123456789abcdef.grupotec.dev.br')).toThrow(/HTTPS/i);
    expect(() => validateRelayBaseUrl('https://gw-0123456789abcdef.cameras.grupotec.dev.br')).toThrow(/dominio/i);
    expect(() => validateRelayBaseUrl('https://example.com')).toThrow(/dominio/i);
  });
});

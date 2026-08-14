import { describe, expect, it } from 'vitest';

import { listenHostForLocalBaseUrl, validateLocalBaseUrl } from './config.ts';

describe('gateway local URL', () => {
  it('aceita loopback e LAN privada', () => {
    expect(validateLocalBaseUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
    expect(listenHostForLocalBaseUrl('http://192.168.1.108:8787')).toBe('0.0.0.0');
  });

  it('rejeita host publico e credencial embutida', () => {
    expect(() => validateLocalBaseUrl('https://example.com:8787')).toThrow(/rede privada/i);
    expect(() => validateLocalBaseUrl('http://user:pass@192.168.1.108:8787')).toThrow(/credenciais/i);
  });
});

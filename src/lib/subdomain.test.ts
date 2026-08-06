import { describe, expect, it } from 'vitest';
import {
  normalizeSubdomain,
  RESERVED_SUBDOMAINS,
  suggestSubdomain,
  validateSubdomain,
} from './subdomain';

describe('Subdomain Utilities', () => {
  describe('normalizeSubdomain', () => {
    it('normaliza maiúsculas, acentos e caracteres especiais', () => {
      expect(normalizeSubdomain(' Escola São José! ')).toBe('escola-sao-jose');
      expect(normalizeSubdomain('Colégio Élite (2026)')).toBe('colegio-elite-2026');
      expect(normalizeSubdomain('---diretorcolocou---')).toBe('diretorcolocou');
    });

    it('retorna string vazia para entrada vazia', () => {
      expect(normalizeSubdomain('')).toBe('');
    });
  });

  describe('validateSubdomain', () => {
    it('valida subdomínio correto', () => {
      const result = validateSubdomain('diretorcolocou');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('valida subdomínio com hífen no meio', () => {
      const result = validateSubdomain('escola-modelo');
      expect(result.valid).toBe(true);
    });

    it('rejeita subdomínio menor que 3 caracteres', () => {
      const result = validateSubdomain('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/entre 3 e 63 caracteres/);
    });

    it('rejeita nome reservado', () => {
      for (const reserved of Array.from(RESERVED_SUBDOMAINS)) {
        const result = validateSubdomain(reserved);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/reservado pelo sistema/);
      }
    });
  });

  describe('suggestSubdomain', () => {
    it('gera sugestão inicial a partir do nome da escola', () => {
      expect(suggestSubdomain('Colégio Santa Maria')).toBe('colegio-santa-maria');
    });

    it('retorna fallback se o nome for muito curto', () => {
      expect(suggestSubdomain('A')).toBe('escola');
    });
  });
});

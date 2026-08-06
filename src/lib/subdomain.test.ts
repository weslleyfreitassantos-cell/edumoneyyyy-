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
      expect(normalizeSubdomain('---escolamodelo---')).toBe('escolamodelo');
    });

    it('retorna string vazia para entrada vazia', () => {
      expect(normalizeSubdomain('')).toBe('');
    });
  });

  describe('validateSubdomain', () => {
    it('valida subdomínio correto', () => {
      const result = validateSubdomain('escolamodelo');
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

    it('rejeita nomes reservados solicitados na especificação', () => {
      const testReserved = ['admin', 'api', 'app', 'auth', 'login', 'dashboard', 'www', 'mail', 'send', 'resend', 'smtp', 'support', 'suporte', 'assets', 'static', 'grupotec'];
      for (const reserved of testReserved) {
        const result = validateSubdomain(reserved);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/reservado pelo sistema/);
      }
    });

    it('rejeita subdomínio com caracteres inválidos, pontos ou hífens nas extremidades', () => {
      expect(validateSubdomain('-escola').valid).toBe(false);
      expect(validateSubdomain('escola-').valid).toBe(false);
      expect(validateSubdomain('escola_modelo').valid).toBe(false);
      expect(validateSubdomain('escola.grupotec.dev.br').valid).toBe(false);
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

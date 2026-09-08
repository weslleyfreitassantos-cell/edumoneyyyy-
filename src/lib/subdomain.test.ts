import { describe, expect, it } from 'vitest';
import {
  classifyHostname,
  getInstitutionEntryUrl,
  getInstitutionOrigin,
  normalizeSubdomain,
  PLATFORM_ORIGIN,
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
      const testReserved = ['admin', 'api', 'app', 'auth', 'login', 'dashboard', 'www', 'mail', 'send', 'resend', 'smtp', 'support', 'suporte', 'assets', 'static', 'grupotec', 'tecescola'];
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

  describe('classifyHostname', () => {
    it('classifica grupotec.dev.br como plataforma', () => {
      expect(classifyHostname('grupotec.dev.br')).toEqual({
        type: 'platform',
        hostname: 'grupotec.dev.br',
      });
    });

    it('classifica tecescola.grupotec.dev.br como plataforma oficial', () => {
      expect(classifyHostname('tecescola.grupotec.dev.br')).toEqual({
        type: 'platform',
        hostname: 'tecescola.grupotec.dev.br',
      });
    });

    it('classifica escolaluz.grupotec.dev.br como instituicao com subdominio escolaluz', () => {
      expect(classifyHostname('escolaluz.grupotec.dev.br')).toEqual({
        type: 'institution',
        hostname: 'escolaluz.grupotec.dev.br',
        subdomain: 'escolaluz',
      });
    });

    it('classifica escola-luz.grupotec.dev.br como instituicao com subdominio escola-luz', () => {
      expect(classifyHostname('escola-luz.grupotec.dev.br')).toEqual({
        type: 'institution',
        hostname: 'escola-luz.grupotec.dev.br',
        subdomain: 'escola-luz',
      });
    });

    it('rejeita hostnames com multiplos subdominios como foo.bar.grupotec.dev.br', () => {
      expect(classifyHostname('foo.bar.grupotec.dev.br')).toEqual({
        type: 'invalid',
        hostname: 'foo.bar.grupotec.dev.br',
      });
    });

    it('rejeita dominios maliciosos ou falsos sufixos como grupotec.dev.br.evil.com', () => {
      expect(classifyHostname('grupotec.dev.br.evil.com')).toEqual({
        type: 'invalid',
        hostname: 'grupotec.dev.br.evil.com',
      });
    });

    it('rejeita subdominios reservados como www.grupotec.dev.br', () => {
      expect(classifyHostname('www.grupotec.dev.br')).toEqual({
        type: 'invalid',
        hostname: 'www.grupotec.dev.br',
      });
    });

    it('classifica localhost como ambiente de desenvolvimento', () => {
      expect(classifyHostname('localhost')).toEqual({
        type: 'development',
        hostname: 'localhost',
      });
      expect(classifyHostname('localhost:3000')).toEqual({
        type: 'development',
        hostname: 'localhost',
      });
    });

    it('classifica 127.0.0.1 como ambiente de desenvolvimento', () => {
      expect(classifyHostname('127.0.0.1')).toEqual({
        type: 'development',
        hostname: '127.0.0.1',
      });
    });

    it('classifica edumoneyyyy.workers.dev como ambiente de desenvolvimento/preview', () => {
      expect(classifyHostname('edumoneyyyy.workers.dev')).toEqual({
        type: 'development',
        hostname: 'edumoneyyyy.workers.dev',
      });
    });
  });

  describe('navegacao entre tenants', () => {
    it('gera o destino do tenant quando a origem atual e um tenant', () => {
      expect(
        getInstitutionEntryUrl('sesi.grupotec.dev.br', 'escola-tv'),
      ).toBe('https://escola-tv.grupotec.dev.br/admin');
    });

    it('envia instituicao sem subdominio para a conta da plataforma', () => {
      expect(
        getInstitutionEntryUrl('sesi.grupotec.dev.br', null),
      ).toBe(`${PLATFORM_ORIGIN}/account`);
    });

    it('nao altera a navegacao interna quando a origem ja e plataforma', () => {
      expect(
        getInstitutionEntryUrl('tecescola.grupotec.dev.br', 'escola-tv'),
      ).toBeNull();
    });

    it('rejeita subdominio invalido antes de montar o hostname', () => {
      expect(getInstitutionOrigin('https://evil.example.com')).toBeNull();
    });
  });
});

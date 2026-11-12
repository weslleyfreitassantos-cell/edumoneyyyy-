import { describe, expect, it } from 'vitest';
import {
  createNubankSimulationFile,
  createNubankSimulationReturnFile,
  parseNubankSimulationReturnFile,
} from './nubankSimulation';

const item = {
  invoiceId: 'invoice-1',
  ourNumber: '0000000000001',
  amountCents: 45000,
  dueDate: '2027-01-10',
  documentNumber: 'Parcela 1',
  payerName: 'Responsável Teste',
  payerDocument: '12345678901',
};

describe('simulador Nubank', () => {
  it('gera um lote JSON explicitamente marcado como simulação', () => {
    const content = createNubankSimulationFile({
      batchId: 'batch-1', sequence: 1, generatedAt: '2027-01-01T12:00:00.000Z',
      companyDocument: '12345678000199', companyName: 'Escola A', items: [item],
    });
    const payload = JSON.parse(content) as Record<string, unknown>;
    expect(payload.simulation).toBe(true);
    expect(payload.provider).toBe('NUBANK_SIMULATION');
    expect(payload.bank_code).toBe('260');
    expect(payload.format).toBe('JSON_SIMULATION');
  });

  it('cria e lê liquidação, rejeição e pagamento parcial de teste', () => {
    const common = { batchId: 'batch-1', generatedAt: '2027-01-01T12:00:00.000Z', items: [item] };
    expect(parseNubankSimulationReturnFile(createNubankSimulationReturnFile(common))[0].status).toBe('SETTLED');
    expect(parseNubankSimulationReturnFile(createNubankSimulationReturnFile({ ...common, mode: 'REJECT_FIRST' }))[0].event_type).toBe('REJECTED');
    expect(parseNubankSimulationReturnFile(createNubankSimulationReturnFile({ ...common, mode: 'PARTIAL_FIRST' }))[0].amount_cents).toBe(22500);
  });

  it('rejeita arquivo de outro provedor', () => {
    expect(() => parseNubankSimulationReturnFile(JSON.stringify({ simulation: true, provider: 'NUBANK', bank_code: '260' }))).toThrow('Arquivo não pertence ao simulador Nubank.');
  });
});

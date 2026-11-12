/**
 * Local Nubank adapter used before the school has an official provider
 * connection. It is intentionally a JSON fixture, never a production boleto
 * or a claim that the file can be uploaded to Nubank.
 */

export type NubankSimulationReturnMode = 'SETTLED' | 'REJECT_FIRST' | 'PARTIAL_FIRST';

export interface NubankSimulationItem {
  invoiceId: string;
  ourNumber: string;
  amountCents: number;
  dueDate: string;
  documentNumber: string;
  payerName: string;
  payerDocument: string;
}

export interface NubankSimulationBatchInput {
  batchId: string;
  sequence: number;
  generatedAt: string;
  companyDocument: string;
  companyName: string;
  items: unknown[];
}

export interface NubankSimulationReturnInput {
  batchId: string;
  generatedAt: string;
  items: unknown[];
  mode?: NubankSimulationReturnMode;
}

export interface NubankSimulationOccurrence {
  provider_event_id: string;
  our_number: string;
  occurrence_code: string;
  event_type: 'SETTLED' | 'REJECTED' | 'RETURNED' | 'UNKNOWN';
  status: 'SETTLED' | 'REJECTED' | 'PENDING_REVIEW';
  amount_cents: number | null;
  paid_at: string | null;
  raw_payload: string;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Item do lote inválido.');
  return value as Record<string, unknown>;
};

const stringAt = (value: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
  }
  throw new Error(`Campo obrigatório ausente: ${keys[0]}.`);
};

const integerAt = (value: Record<string, unknown>, ...keys: string[]): number => {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate > 0) return candidate;
  }
  throw new Error(`Valor obrigatório inválido: ${keys[0]}.`);
};

function normalizeItem(value: unknown): NubankSimulationItem {
  const item = asRecord(value);
  return {
    invoiceId: stringAt(item, 'invoiceId', 'invoice_id'),
    ourNumber: stringAt(item, 'ourNumber', 'our_number'),
    amountCents: integerAt(item, 'amountCents', 'amount_cents'),
    dueDate: stringAt(item, 'dueDate', 'due_date'),
    documentNumber: stringAt(item, 'documentNumber', 'document_number'),
    payerName: stringAt(item, 'payerName', 'payer_name'),
    payerDocument: stringAt(item, 'payerDocument', 'payer_document'),
  };
}

function normalizeItems(items: unknown[]): NubankSimulationItem[] {
  if (!Array.isArray(items) || items.length < 1 || items.length > 9999) throw new Error('O lote deve conter entre 1 e 9.999 parcelas.');
  return items.map(normalizeItem);
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createNubankSimulationFile(input: NubankSimulationBatchInput): string {
  if (!input.batchId || !Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new Error('Lote Nubank inválido.');
  const items = normalizeItems(input.items);
  return stableJson({
    schema: 'edumoney.nubank.simulation.v1',
    simulation: true,
    provider: 'NUBANK_SIMULATION',
    bank_code: '260',
    format: 'JSON_SIMULATION',
    batch_id: input.batchId,
    sequence_number: input.sequence,
    generated_at: input.generatedAt,
    company: { document: input.companyDocument, name: input.companyName },
    charges: items.map((item) => ({
      invoice_id: item.invoiceId,
      our_number: item.ourNumber,
      amount_cents: item.amountCents,
      due_date: item.dueDate,
      document_number: item.documentNumber,
      payer: { name: item.payerName, document: item.payerDocument },
      status: 'REGISTERED',
    })),
  });
}

export function createNubankSimulationReturnFile(input: NubankSimulationReturnInput): string {
  if (!input.batchId) throw new Error('Lote Nubank inválido.');
  const items = normalizeItems(input.items);
  const mode = input.mode ?? 'SETTLED';
  const generatedAt = new Date(input.generatedAt);
  if (Number.isNaN(generatedAt.getTime())) throw new Error('Data do retorno Nubank inválida.');
  const paidAt = generatedAt.toISOString();
  const occurrences = items.map((item, index) => {
    const rejected = mode === 'REJECT_FIRST' && index === 0;
    const partial = mode === 'PARTIAL_FIRST' && index === 0;
    const amount = rejected ? null : partial ? Math.max(1, Math.floor(item.amountCents / 2)) : item.amountCents;
    const eventType = rejected ? 'REJECTED' : 'SETTLED';
    return {
      provider_event_id: `nubank-sim:${input.batchId}:${item.ourNumber}:${eventType}`,
      our_number: item.ourNumber,
      occurrence_code: rejected ? 'REJECTED_TEST' : partial ? 'PARTIAL_TEST' : 'SETTLED_TEST',
      event_type: eventType,
      status: rejected ? 'REJECTED' : 'SETTLED',
      amount_cents: amount,
      paid_at: rejected ? null : paidAt,
      test_case: rejected ? 'rejected' : partial ? 'partial' : 'settled',
    };
  });
  return stableJson({
    schema: 'edumoney.nubank.simulation.v1',
    simulation: true,
    provider: 'NUBANK_SIMULATION',
    bank_code: '260',
    format: 'JSON_SIMULATION_RETURN',
    batch_id: input.batchId,
    generated_at: paidAt,
    occurrences,
  });
}

export function parseNubankSimulationReturnFile(content: string): NubankSimulationOccurrence[] {
  let payload: unknown;
  try {
    payload = JSON.parse(content) as unknown;
  } catch {
    throw new Error('O retorno Nubank simulado não é um JSON válido.');
  }
  const root = asRecord(payload);
  if (root.schema !== 'edumoney.nubank.simulation.v1' || root.simulation !== true || root.provider !== 'NUBANK_SIMULATION' || root.bank_code !== '260' || root.format !== 'JSON_SIMULATION_RETURN') {
    throw new Error('Arquivo não pertence ao simulador Nubank.');
  }
  if (!Array.isArray(root.occurrences) || root.occurrences.length < 1 || root.occurrences.length > 9999) {
    throw new Error('O retorno Nubank não contém ocorrências válidas.');
  }
  return root.occurrences.map((value) => {
    const occurrence = asRecord(value);
    const eventType = stringAt(occurrence, 'event_type').toUpperCase();
    const status = stringAt(occurrence, 'status').toUpperCase();
    if (!['SETTLED', 'REJECTED', 'RETURNED', 'UNKNOWN'].includes(eventType) || !['SETTLED', 'REJECTED', 'PENDING_REVIEW'].includes(status)) {
      throw new Error('Ocorrência Nubank inválida.');
    }
    const amount = occurrence.amount_cents === null ? null : integerAt(occurrence, 'amount_cents');
    const paidAt = occurrence.paid_at === null ? null : stringAt(occurrence, 'paid_at');
    return {
      provider_event_id: stringAt(occurrence, 'provider_event_id'),
      our_number: stringAt(occurrence, 'our_number'),
      occurrence_code: stringAt(occurrence, 'occurrence_code'),
      event_type: eventType as NubankSimulationOccurrence['event_type'],
      status: status as NubankSimulationOccurrence['status'],
      amount_cents: amount,
      paid_at: paidAt,
      raw_payload: JSON.stringify(occurrence),
    };
  });
}

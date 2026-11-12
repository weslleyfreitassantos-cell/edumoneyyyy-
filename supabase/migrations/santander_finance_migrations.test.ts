import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const config = read('20261111010000_finance_bank_configuration.sql');
const batch = read('20261111020000_santander_remittance_batches.sql');
const reconciliation = read('20261111030000_santander_return_reconciliation.sql');
const exportMigration = read('20261111040000_santander_batch_export.sql');
const occurrenceList = read('20261111050000_santander_return_occurrence_list.sql');

describe('migrações do fluxo Santander', () => {
  it('mantém a configuração completa e o lote idempotente', () => {
    expect(config).toContain('finance_set_bank_configuration_v2');
    expect(config).toContain('agency_digit');
    expect(batch).toContain('finance_create_santander_remittance_batch');
    expect(batch).toContain("insert into public.finance_remittance_batches(institution_id, bank_code, format");
    expect(batch).toContain('SANTANDER_INVOICE_ALREADY_BATCHED');
  });

  it('protege o retorno por instituição e evita baixa duplicada', () => {
    expect(reconciliation).toContain('unique (institution_id, provider_event_id)');
    expect(reconciliation).toContain("provider in ('MOCK', 'MANUAL', 'SANTANDER')");
    expect(reconciliation).toContain("provider = 'SANTANDER'");
    expect(reconciliation).toContain('on conflict (institution_id, provider_event_id) do nothing');
    expect(occurrenceList).toContain('finance_list_santander_return_occurrences');
  });

  it('registra o hash do arquivo que foi exportado', () => {
    expect(exportMigration).toContain('finance_mark_santander_remittance_exported');
    expect(exportMigration).toContain("status = case when status = 'GENERATED' then 'EXPORTED'");
    expect(exportMigration).toContain("'SANTANDER_BATCH_EXPORT_HASH_MISMATCH'");
  });
});

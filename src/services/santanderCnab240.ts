/** Structural validation only. This does not register or settle charges. */
export function validateSantanderCnab240(content: string): { records: number; segments: string[] } {
  if (!content || /[^\x20-\x7e\r\n]/.test(content)) throw new Error('Arquivo contém caracteres inválidos.');
  const lines = content.split(/\r\n|\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines.length < 4 || lines.some((line) => line.length !== 240)) throw new Error('Cada registro deve ter 240 posições.');
  if (lines.some((line) => line.slice(0, 3) !== '033')) throw new Error('Arquivo não pertence ao Santander.');
  if (lines[0][7] !== '0' || lines[lines.length - 1][7] !== '9') throw new Error('Cabeçalho ou trailer do arquivo inválido.');
  const segments = lines.filter((line) => line[7] === '3').map((line) => line[13]);
  return { records: lines.length, segments };
}

/** Header for test fixtures only; remaining records and bank homologation are required. */
export function createSantanderTestHeader(input: { document: string; transmissionCode: string; company: string; date: string; sequence: number }): string {
  const numeric = (value: string, length: number) => {
    if (!/^\d+$/.test(value) || value.length > length) throw new Error('Campo numérico inválido.');
    return value.padStart(length, '0');
  };
  if (![11, 14].includes(input.document.length)) throw new Error('Documento inválido.');
  if (!/^\d{8}$/.test(input.date) || !Number.isInteger(input.sequence) || input.sequence < 1) throw new Error('Data ou sequência inválida.');
  const company = input.company.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (!company.trim() || /[^\x20-\x7e]/.test(company) || company.length > 30) throw new Error('Nome inválido.');
  return '03300000' + ' '.repeat(8) + (input.document.length === 11 ? '1' : '2') + numeric(input.document, 15)
    + numeric(input.transmissionCode, 15) + ' '.repeat(25) + company.padEnd(30, ' ')
    + 'BANCO SANTANDER'.padEnd(30, ' ') + ' '.repeat(10) + '1' + input.date + ' '.repeat(6)
    + numeric(String(input.sequence), 6) + '040' + ' '.repeat(74);
}

/** Segment Q for offline test fixtures. Not connected to real invoices. */
export function createSantanderTestPayer(input: { sequence: number; document: string; name: string; address: string; district: string; zip: string; city: string; state: string }): string {
  const digits = (value: string, width: number) => {
    if (!/^\d+$/.test(value) || value.length > width) throw new Error('Campo numérico inválido.');
    return value.padStart(width, '0');
  };
  const text = (value: string, width: number) => {
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!normalized.trim() || normalized.length > width || /[^\x20-\x7e]/.test(normalized)) throw new Error('Campo de texto inválido.');
    return normalized.padEnd(width, ' ');
  };
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || ![11, 14].includes(input.document.length) || !/^\d{8}$/.test(input.zip) || !/^[A-Za-z]{2}$/.test(input.state)) throw new Error('Dados do pagador inválidos.');
  return '03300013' + digits(String(input.sequence), 5) + 'Q 01' + (input.document.length === 11 ? '1' : '2')
    + digits(input.document, 15) + text(input.name, 40) + text(input.address, 40) + text(input.district, 15)
    + input.zip + text(input.city, 15) + input.state.toUpperCase() + '0' + '0'.repeat(15) + ' '.repeat(40) + '0'.repeat(12) + ' '.repeat(19);
}

/** Build test trailers only; no bank registration or settlement is performed. */
export function createSantanderTestTrailers(detailCount: number): [string, string] {
  if (!Number.isSafeInteger(detailCount) || detailCount < 0 || detailCount > 999995) throw new Error('Quantidade inválida.');
  const count = (value: number) => String(value).padStart(6, '0');
  return [
    '03300015' + ' '.repeat(9) + count(detailCount + 2) + ' '.repeat(217),
    '03399999' + ' '.repeat(9) + count(1) + count(detailCount + 4) + ' '.repeat(211),
  ];
}

/** Offline fixture for a simple registered charge; never submit without homologation. */
export function createSantanderTestTitle(input: { sequence: number; agency: string; agencyDigit: string; account: string; accountDigit: string; ourNumber: string; documentNumber: string; dueDate: string; issueDate: string; amountCents: number; reference: string }): string {
  const n = (value: string, width: number) => {
    if (!/^\d+$/.test(value) || value.length > width) throw new Error('Campo numérico inválido.');
    return value.padStart(width, '0');
  };
  const a = (value: string, width: number) => {
    const s = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!s.trim() || s.length > width || /[^\x20-\x7e]/.test(s)) throw new Error('Campo de texto inválido.');
    return s.padEnd(width, ' ');
  };
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || !Number.isSafeInteger(input.sequence) || input.sequence < 1 || !/^\d{8}$/.test(input.dueDate) || !/^\d{8}$/.test(input.issueDate)) throw new Error('Valor, sequência ou data inválidos.');
  return '03300013' + n(String(input.sequence), 5) + 'P 01' + n(input.agency, 4) + n(input.agencyDigit, 1)
    + n(input.account, 9) + n(input.accountDigit, 1) + '0'.repeat(10) + '  ' + n(input.ourNumber, 13)
    + '511  ' + a(input.documentNumber, 15) + input.dueDate + n(String(input.amountCents), 15)
    + '00000 ' + '17N' + input.issueDate + '3' + '0'.repeat(8 + 15) + '0' + '0'.repeat(8 + 15 + 15 + 15)
    + a(input.reference, 25) + '000' + '2000' + '00' + ' '.repeat(11);
}

export interface SantanderRemittanceItem {
  ourNumber: string;
  amountCents: number;
  dueDate: string;
  documentNumber: string;
  payerName: string;
  payerDocument: string;
  payerAddress: string;
  payerDistrict: string;
  payerZip: string;
  payerCity: string;
  payerState: string;
}

export interface SantanderRemittanceInput {
  companyDocument: string;
  companyName: string;
  transmissionCode: string;
  agency: string;
  agencyDigit: string;
  account: string;
  accountDigit: string;
  wallet: string;
  sequence: number;
  generatedAt: string;
  items: SantanderRemittanceItem[];
}

function normalizeDate(value: string): string {
  if (/^\d{8}$/.test(value)) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(8, 10) + value.slice(5, 7) + value.slice(0, 4);
  throw new Error('Data inválida para CNAB Santander.');
}

function createSantanderLotHeader(input: SantanderRemittanceInput): string {
  const n = (value: string, width: number) => {
    if (!/^\d+$/.test(value) || value.length > width) throw new Error('Campo numérico inválido.');
    return value.padStart(width, '0');
  };
  const text = (value: string, width: number) => {
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!normalized.trim() || normalized.length > width || /[^\x20-\x7e]/.test(normalized)) throw new Error('Campo de texto inválido.');
    return normalized.padEnd(width, ' ');
  };
  return '03300011' + ' '.repeat(5) + 'R' + '01' + ' '.repeat(3) + '030' + ' ' + '2'
    + n(input.companyDocument, 15) + ' '.repeat(20) + n(input.transmissionCode, 15)
    + ' '.repeat(5) + text(input.companyName, 30) + ' '.repeat(40) + ' '.repeat(40)
    + '00000001' + normalizeDate(input.generatedAt) + ' '.repeat(35);
}

function createSantanderLotTrailer(detailCount: number): string {
  const n = (value: number, width: number) => String(value).padStart(width, '0');
  return '03300015' + ' '.repeat(9) + n(detailCount + 2, 6) + ' '.repeat(217);
}

function createSantanderFileTrailer(lotCount: number, recordCount: number): string {
  const n = (value: number, width: number) => String(value).padStart(width, '0');
  return '03399999' + ' '.repeat(9) + n(lotCount, 6) + n(recordCount, 6) + ' '.repeat(211);
}

/** Builds one Santander CNAB 240 collection file from an already reserved batch. */
export function createSantanderRemittanceFile(input: SantanderRemittanceInput): string {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1 || input.sequence > 999999) throw new Error('Sequência de lote inválida.');
  if (!input.items.length || input.items.length > 9999) throw new Error('O lote deve conter entre 1 e 9.999 parcelas.');
  const date = normalizeDate(input.generatedAt);
  const header = createSantanderTestHeader({ document: input.companyDocument, transmissionCode: input.transmissionCode, company: input.companyName, date, sequence: input.sequence });
  const lotHeader = createSantanderLotHeader(input);
  const records: string[] = [header, lotHeader];
  for (const [index, item] of input.items.entries()) {
    records.push(createSantanderTestTitle({
      sequence: index + 1,
      agency: input.agency,
      agencyDigit: input.agencyDigit,
      account: input.account,
      accountDigit: input.accountDigit,
      ourNumber: item.ourNumber,
      documentNumber: item.documentNumber,
      dueDate: normalizeDate(item.dueDate),
      issueDate: date,
      amountCents: item.amountCents,
      reference: input.wallet,
    }));
    records.push(createSantanderTestPayer({
      sequence: index + 1,
      document: item.payerDocument,
      name: item.payerName,
      address: item.payerAddress,
      district: item.payerDistrict,
      zip: item.payerZip,
      city: item.payerCity,
      state: item.payerState,
    }));
  }
  records.push(createSantanderLotTrailer(input.items.length));
  records.push(createSantanderFileTrailer(1, records.length + 1));
  const content = records.join('\r\n') + '\r\n';
  validateSantanderCnab240(content);
  return content;
}

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

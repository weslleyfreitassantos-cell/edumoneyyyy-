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

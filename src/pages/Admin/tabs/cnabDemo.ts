// Demonstração de comprimento fixo; não representa um layout bancário homologado.
export function generateCnabDemo(): string {
  const records = [
    'DEMONSTRACAO CNAB 240 - NAO ENVIAR AO BANCO',
    'ESCOLA FICTICIA | ALUNO EXEMPLO 001 | VENCIMENTO 10/01/2027 | VALOR 000000000045000',
    'ESCOLA FICTICIA | ALUNO EXEMPLO 002 | VENCIMENTO 10/01/2027 | VALOR 000000000038000',
    'FIM DA DEMONSTRACAO | 2 COBRANCAS FICTICIAS | TOTAL 000000000083000',
  ];
  return records.map((record) => record.padEnd(240, ' ')).join('\r\n') + '\r\n';
}

export function downloadCnabDemo(): void {
  const url = URL.createObjectURL(new Blob([generateCnabDemo()], { type: 'text/plain;charset=us-ascii' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'demonstracao-nao-enviar-ao-banco.txt';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

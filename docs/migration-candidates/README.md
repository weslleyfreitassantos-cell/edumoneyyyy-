# Migration candidates

Esta pasta guarda candidatos de migration para revisao tecnica.

Os arquivos aqui:

- nao sao migrations aplicadas;
- nao ficam em `supabase/migrations`;
- nao devem ser executados sem revisao;
- dependem de baseline e reconciliacao do historico remoto;
- devem ser testados em staging antes de qualquer aplicacao em producao.

Enquanto a reconciliacao nao estiver concluida, `db push`, `migration repair`
e `db reset` continuam bloqueados para o remoto.

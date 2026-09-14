# Supabase Egress Baseline

Esta medição registra o ponto de partida para a redução de transferência antes da migração para outro projeto Supabase. O total acumulado não é uma métrica de comparação desta mudança.

## Estado observado

- Egress acumulado no ciclo: aproximadamente `30.994 GB` em um plano de `5 GB`.
- Database: aproximadamente `49 MB`.
- MAU: `16`.

Esses valores são contexto operacional e não provam que todo o egress foi causado por uma única tela ou consulta.

## Workload reproduzível

1. Login como `DIRECTOR`.
2. Abrir Visão Geral cinco vezes.
3. Abrir Alunos cinco vezes.
4. Pesquisar três alunos.
5. Navegar por cinco páginas de alunos.
6. Abrir Matrículas cinco vezes.
7. Gerar um relatório de resultados.
8. Gerar um relatório de frequência.
9. Abrir os destinatários da comunicação institucional uma vez.

Para comparar antes e depois, registrar o delta do egress durante exatamente esse workload, a quantidade de requests e, quando possível, o tamanho das respostas na aba Network. O contador acumulado do projeto não deve ser usado como resultado da comparação.

## Escopo da otimização

- filtros de tenant e busca devem ser enviados ao Postgres;
- a listagem de alunos deve buscar somente uma página leve;
- matrículas atuais devem ser buscadas apenas para os alunos visíveis;
- a capacidade deve usar `COUNT` com `HEAD`;
- a RPC rápida do overview não deve disparar fallback pesado em erros transitórios;
- destinatários responsáveis devem ser filtrados por instituição antes do retorno.

Nenhuma migração de projeto, alteração remota ou deploy manual faz parte desta etapa.

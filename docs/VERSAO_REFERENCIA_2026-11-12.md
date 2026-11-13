# Versao de referencia do produto

Status: CONGELADA
Data de referencia: 2026-11-12 21:26 BRT
Referencia Git do codigo publicado: 3d54188c46006a0d88670ff79433659a91b90267
Referencia da publicacao: Worker edumoneyyyy, versao ba88885b-0923-4e0b-9a65-1b6f60328f98
Tag oficial: baseline-2026-11-12-2126

## Regra obrigatoria para o trabalho futuro

Toda nova alteracao deve partir da tag oficial ou de um branch criado a partir dela.
Nenhuma publicacao pode usar uma branch antiga, um commit anterior ou uma copia
parcial do projeto sem comparar primeiro com esta referencia.

Antes de alterar qualquer tela, validar o comportamento atual e preservar o que
ja existe. Nao remover, substituir ou reverter elementos de background, identidade
visual, carregamento, financeiro, rematricula ou outros fluxos sem uma solicitacao
explicita e registrada.

## O que esta referencia preserva

- Background, identidade visual e carregamento da escola no primeiro acesso.
- Financeiro com configuracao de multiplas contas, conta principal, selecao de
  banco, status da conta e botao para nova conta.
- Mensalidades com aviso neutro enquanto os dados bancarios nao estiverem
  configurados e bloqueio seguro da remessa e do retorno nesse estado.
- Fluxo de remessa, retorno e conciliacao existente.
- Rematricula com rotulo de matriculado ou matriculada conforme o sexo do aluno.

## Checklist antes de publicar

1. Confirmar que o branch foi criado a partir de `baseline-2026-11-12-2126`.
2. Revisar o diff completo contra a tag e verificar que nao houve regressao.
3. Executar os testes direcionados, o typecheck e o build.
4. Validar a tela alterada e os fluxos preservados em producao.
5. Registrar qualquer mudanca intencional de comportamento antes do deploy.

Esta referencia e a fonte de verdade para as proximas evolucoes do projeto.

# Biblioteca de Atividades — Educação Inclusiva

## Entrega local

Esta etapa implementa uma biblioteca local para avaliação visual e funcional, sem deploy, sem execução de migrations remotas e sem dados reais de estudantes.

### Atividades próprias

O catálogo local contém 19 atividades em português brasileiro, com objetivo, etapa sugerida, instruções, conteúdo, adaptações e visualização:

- Minha rotina na escola
- Vamos lavar as mãos?
- Encontre a figura correspondente
- Descobrindo as vogais
- Formando sílabas
- Leitura compartilhada
- Vamos contar de 1 a 5
- Vamos contar de 1 a 10
- Complete a sequência
- Cores e formas
- Compras do dia a dia
- Antes e depois
- Quebra-cabeça visual
- Jogo da memória
- Bingo de números e palavras
- Quadro de escolhas
- Explorando os sentidos
- Comunicação em diferentes formas
- Checklist de acessibilidade

As ilustrações da biblioteca são SVGs originais locais, acessíveis por teclado e com texto alternativo. Elas não usam imagens de terceiros.

## Recursos externos

O catálogo também mantém recursos externos com crédito, URL original, instituição/autoria, licença ou observação de direitos e ação explícita de abertura externa. Os recursos eduCAPES, IBGEeduca, GCompris, SEN Teacher, Do2Learn, ARASAAC, LearningApps, H5P, OpenMoji, CAST e W3C permanecem apontando para suas fontes. A Tec Escola não redistribui PDFs, imagens ou pictogramas de terceiros.

## Materiais imprimíveis locais

Há quatro folhas A4 locais, com conteúdo utilizável e botão de abertura/impressão:

- `public/inclusive-materials/checklist-acessibilidade.html`
- `public/inclusive-materials/rotina-visual.html`
- `public/inclusive-materials/guia-adaptacoes.html`
- `public/inclusive-materials/registro-observacao.html`

O navegador gera o PDF pela opção **Imprimir > Salvar como PDF**. Isso é deliberado nesta fase: ainda não existe um gerador de PDF binário integrado ao módulo.

## Exercícios

Os seis mecanismos aparecem na tela de Exercícios Interativos: associação, memória, quebra-cabeça, sequência, contagem e classificação. A associação, sequência, contagem e classificação já apresentam conteúdo visual e validação local. Memória e quebra-cabeça ainda estão na camada inicial de demonstração funcional e precisam de uma rodada específica para completar múltiplas peças/pares e acessibilidade por teclado.

## Vídeos para atividades didáticas

Foi adicionado o submenu **Vídeos para atividades didáticas** com 10 buscas públicas do YouTube. Os links abrem externamente e não enviam dados de estudantes. Eles são buscas públicas, não vídeos incorporados nem recomendações patrocinadas; a curadoria de IDs individuais e a revisão periódica dos canais ficam pendentes.

## Rotas e segurança

- `/inclusive-education`: visão geral
- `/inclusive-education/activities`: biblioteca
- `/inclusive-education/exercises`: exercícios
- `/inclusive-education/materials`: materiais para download
- `/inclusive-education/videos`: vídeos externos
- `/inclusive-education/pei`, `/inclusive-education/aee-paee` e `/inclusive-education/progress`: estados seguros sem persistência inventada

PEI, AEE/PAEE e evolução não exibem dados fictícios. A persistência e os documentos sensíveis continuam bloqueados até a migration e as policies RLS serem validadas em ambiente autorizado.

## Verificações realizadas

- `npm run typecheck`
- `npm run build`
- `npx vitest run src/components/inclusive/inclusiveEducationCatalog.test.ts`
- Verificação visual local da biblioteca, detalhe de atividade, exercícios e materiais no navegador.

## Pendências honestas

1. Integrar um gerador de PDF real para downloads binários, mantendo a impressão HTML como fallback.
2. Completar memória com múltiplos pares e quebra-cabeça com peças reais, clique e teclado.
3. Curar vídeos individualmente, conferindo título, canal, acessibilidade e disponibilidade.
4. Aplicar persistência segura de PEI/AEE somente depois de revisar histórico de migrations, RLS e isolamento entre instituições.
5. Criar testes E2E automatizados para os sete submenus e os fluxos de impressão/abertura externa.

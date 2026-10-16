# Educação Inclusiva — Reformulação Visual

## Estado da entrega local

Foi criada uma biblioteca visual própria em `src/components/inclusive/InclusiveIllustration.tsx`. As ilustrações são SVGs locais, escaláveis, sem dependência de URLs externas e com `aria-label` descritivo. Elas aparecem nos cards da Biblioteca, no detalhe imprimível e nos exercícios interativos.

## Matriz das atividades

| Atividade | Ilustração | Tipo | PDF/Impressão | Interativo | Status |
|---|---|---|---|---|---|
| Minha rotina na escola | cartões de rotina | sequência | impressão do detalhe | catálogo | visual integrado |
| Vamos lavar as mãos? | etapas de higiene | sequência | impressão do detalhe | catálogo | visual integrado |
| Encontre a figura correspondente | bola, casa e livro | associação | impressão do detalhe | associação visual | visual integrado |
| Descobrindo as vogais | cartões palavra-imagem | alfabetização | impressão do detalhe | catálogo | visual integrado |
| Formando sílabas | cartões de alfabetização | alfabetização | impressão do detalhe | catálogo | visual integrado |
| Leitura compartilhada | cartão de leitura | leitura | impressão do detalhe | catálogo | visual integrado |
| Vamos contar de 1 a 5 | lápis ilustrados | contagem | impressão do detalhe | contagem visual | visual integrado |
| Vamos contar de 1 a 10 | objetos para contar | contagem | impressão do detalhe | contagem visual | visual integrado |
| Complete a sequência | formas e padrão | sequência | impressão do detalhe | sequência lógica | visual integrado |
| Cores e formas | formas coloridas | classificação | impressão do detalhe | classificação | visual integrado |
| Compras do dia a dia | cesta e itens | matemática funcional | impressão do detalhe | catálogo | visual integrado |
| Antes e depois | plantar, regar e observar | sequência temporal | impressão do detalhe | sequência | visual integrado |
| Quebra-cabeça visual | ambiente escolar | puzzle | impressão do detalhe | mecanismo de puzzle | visual integrado |
| Jogo da memória | cartas ilustradas | memória | impressão do detalhe | memória | visual integrado |
| Bingo de números e palavras | cartas de jogo | bingo | impressão do detalhe | catálogo | visual integrado |
| Quadro de escolhas | cartões de necessidades | comunicação | impressão do detalhe | escolha | visual integrado |
| Descobrindo os sentidos | objetos sensoriais | ciências | impressão do detalhe | classificação | visual integrado |
| O que posso comunicar? | cartões de comunicação | comunicação | impressão do detalhe | escolha | visual integrado |
| Planejando uma adaptação | quadro de planejamento | professor | impressão do detalhe | catálogo | visual integrado |

## Componentes e ações

- `InclusiveIllustration.tsx`: registro visual SVG próprio e acessível.
- `InclusiveEducationPage.tsx`: miniaturas, detalhe ilustrado, impressão e exercício com ilustração contextual.
- `inclusiveEducationCatalog.ts`: conteúdo pedagógico e associação de cada atividade ao visual correspondente.
- `public/inclusive-materials/`: arquivos autorais locais para download.

## Limitações declaradas

- “Imprimir / salvar PDF” usa o diálogo de impressão do navegador; não é um arquivo PDF pré-gerado.
- Os quatro materiais antigos continuam em texto simples e ainda precisam ser diagramados como folhas A4 ilustradas independentes.
- O mecanismo de quebra-cabeça e memória existente ainda precisa receber a lógica completa de múltiplas peças/cartas ilustradas; nesta fase o visual contextual foi integrado sem simular uma conclusão inexistente.
- PEI, AEE/PAEE e Evolução continuam sem dados fictícios e dependem de persistência/RLS autorizada.

## Validação

`npm run typecheck` passou após a integração visual. A aba local foi aberta anteriormente em `http://localhost:5173/inclusive-education`; após a última alteração, a reconexão do plugin do navegador oscilou, então a conferência visual final da nova versão precisa ser repetida no navegador quando a aba estiver disponível.

Não houve deploy, alteração remota de banco ou migration remota.

## Ampliação posterior — vídeos e folhas diagramadas

Foi adicionado o submenu `Vídeos para atividades didáticas` em `/inclusive-education/videos`, com dez pesquisas públicas externas no YouTube, aviso de privacidade e abertura fora da Tec Escola. Foram evitados vídeos embutidos e downloads de terceiros.

Os quatro materiais locais passaram a ter folhas HTML A4 diagramadas em `public/inclusive-materials/`: checklist, rotina visual, guia de adaptações e registro de observação. A interface agora usa “Abrir folha A4” e “Imprimir / salvar PDF”, sem prometer download PDF inexistente.

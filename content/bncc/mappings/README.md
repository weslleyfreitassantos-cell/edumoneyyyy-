# Mapeamento BNCC → grafo TecEscola

`coverage-2018.json` é a matriz de prestação de contas do catálogo oficial.
Ela contém uma linha para cada código extraído da versão congelada da BNCC.

`UNACCOUNTED` é intencionalmente diferente de `MAPPED`: significa que a
habilidade ainda precisa de decisão pedagógica e não pode aparecer como
conteúdo alinhado automaticamente. Uma linha só pode virar `MAPPED` quando
referenciar uma ou mais habilidades canônicas existentes e registrar a fonte,
a confiança e a revisão correspondente. Objetivos que não são adaptativos
devem usar `EXPLICITLY_NON_ADAPTIVE` com justificativa explícita.

O catálogo oficial e o grafo TecEscola permanecem camadas separadas. O V4
atual continua sendo conteúdo derivado da TecEscola; ele não é promovido a
BNCC oficial por semelhança textual.

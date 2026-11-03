# Rematrícula Automática V1

## Escopo

Esta entrega adiciona uma camada de rematrícula anual sem alterar matrículas, histórico ou financeiro existentes. A campanha cria uma solicitação por aluno, registra aceite versionado do contrato e permite que a equipe revise resultado acadêmico e situação financeira antes da matrícula definitiva.

## Fluxo seguro

1. Direção ou Secretaria cria a campanha em rascunho.
2. A escola revisa anos de origem/destino, período e contrato, depois abre a campanha.
3. Aluno ou responsável inicia a solicitação. O banco localiza a matrícula ativa do ano de origem e registra um protocolo idempotente.
4. O usuário lê o texto do contrato, aceita a versão/hash e confirma.
5. A equipe revisa o resultado acadêmico e, quando aplicável, a liberação financeira.
6. A solicitação chega a `READY_FOR_ENROLLMENT`. A matrícula definitiva continua sendo uma operação separada e explícita.

## Proteções

- Todas as tabelas são novas, têm RLS e estão limitadas à instituição do usuário.
- Confirmação e revisão usam funções protegidas no schema `private`.
- Solicitações duplicadas para a mesma campanha e aluno são bloqueadas por índice único.
- O aceite é vinculado à versão e ao hash do contrato.
- Nenhuma função desta versão insere em `enrollments`, `invoices`, `financial_contracts` ou `payments`.
- A migração é aditiva e não deve ser aplicada automaticamente em produção nesta branch.

## Ativação futura

Antes de ativar a matrícula definitiva, a equipe deve validar o resultado final, recuperação, conselho de classe, turma de destino, regras financeiras e o gateway escolhido. A criação de cobranças reais deve ser uma etapa explícita, com idempotência e observabilidade próprias.

# Fluxo financeiro da rematrícula

## Regra da cobrança

A cobrança de rematrícula não é obrigatória para toda escola particular. Quando a escola optar por cobrar, o valor deve estar previsto com clareza no contrato e integrar o preço total anual ou semestral contratado; não deve ser uma taxa extra fora desse total. A regra vem do art. 1º da Lei nº 9.870/1999 e é reforçada pela orientação do Procon-SP.

- [Lei nº 9.870/1999, art. 1º](https://legis.senado.gov.br/norma/551746/publicacao/15795359)
- [Orientação do Procon-SP sobre rematrícula e reajustes](https://www.procon.sp.gov.br/procon-sp-alerta-para-cuidados-na-rematricula-escolar-e-orienta-sobre-reajustes-de-mensalidades/)

Por isso, a campanha deve continuar permitindo os modos `NOT_REQUIRED`, `MANUAL` e `AUTO`. A escola só deve exigir pagamento quando tiver configurado essa condição para a campanha.

## Fluxo atual

1. A Direção ou a Secretaria autorizada configura a conta bancária da escola em **Financeiro → Configurações** e define as condições financeiras da campanha.
2. O responsável acessa o portal, escolhe o aluno e confirma a rematrícula conforme o contrato apresentado.
3. A Secretaria ou a Direção usa **Preparar cobrança** no painel da campanha. Essa ação cria o vínculo financeiro e a cobrança principal para aquele pedido, sem duplicar uma cobrança já existente.
4. O responsável passa a ver **Acessar boleto da rematrícula** ao lado do aluno. A tela mostra referência, vencimento, valor e situação da cobrança.
5. Enquanto não houver registro bancário, a tela informa que o PDF, o código de barras e a linha digitável ainda dependem da integração com o banco. Nenhum documento bancário fictício é apresentado.
6. Depois da integração bancária, o mesmo ponto da tela poderá abrir ou baixar o boleto registrado. O retorno do banco atualizará o pagamento e permitirá exibir o comprovante.

## O que esta entrega cobre

- Consulta segura da cobrança vinculada ao pedido de rematrícula.
- Isolamento por instituição e respeito às regras de acesso do responsável financeiro.
- Botão de boleto para cobrança em aberto e botão de comprovante para cobrança paga.
- Exibição de valor, vencimento, referência, valor pago e situação.
- Tratamento visual explícito enquanto o registro bancário ainda não estiver disponível.

## O que ainda depende do banco

Falta somente a etapa que transforma a cobrança interna em um boleto bancário válido: registro no banco escolhido, geração do PDF/código de barras/linha digitável e importação do retorno para conciliação. Essa etapa não pode ser simulada como se fosse um boleto real, porque depende do convênio e das credenciais da instituição.

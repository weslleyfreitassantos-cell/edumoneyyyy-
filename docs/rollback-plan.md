# Plano de Rollback

Em caso de falha crítica identificada pós-deploy em produção:

1. **Identificar último deploy estável**
   - Acessar o histórico de deploys no painel do provedor de hospedagem frontend.
   - Localizar a última versão funcional que foi aprovada e homologada.

2. **Reverter a Aplicação Frontend (Rollback do Deploy)**
   - Utilizar a opção de *Rollback* ou *Promote* para restaurar o deploy anterior no provedor imediatamente.
   - Confirmar que o frontend público reflete a versão anterior.

3. **Restrições Importantes**
   - **NÃO** executar rollback de migrations no banco de dados automaticamente. Isso requer avaliação cuidadosa para evitar perda de dados recém-inseridos.
   - **NÃO** apagar dados de produção.
   - Restaurar a variável `APP_URL` na infraestrutura caso a mesma tenha sido alterada em decorrência do novo deploy problemático.

4. **Validação de Recuperação**
   - Validar login.
   - Validar fluxo de convite.
   - Validar navegação básica das rotas principais para assegurar que a versão revertida opera sem bloqueios.

5. **Post-Mortem**
   - Registrar incidente descrevendo: a falha encontrada, a data e hora, logs de erro pertinentes (se existirem), as ações tomadas para a reversão e o status final do ambiente (recuperado).

# Checklist de Preparação para Staging

## 1. Frontend e Hospedagem
- [ ] Frontend publicado
- [ ] Variáveis configuradas (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
- [ ] Fallback SPA configurado na hospedagem
- [ ] Nenhuma URL localhost hardcoded

## 2. Supabase e Autenticação
- [ ] Site URL configurado no Supabase
- [ ] Redirect URLs configurados no Supabase (incluindo /auth/confirm, /auth/reset-password, /login, /admin, /account)
- [ ] SMTP configurado para envio de emails
- [ ] Fluxo de convite verificado
- [ ] Fluxo de recuperação de senha verificado
- [ ] Variáveis APP_URL configuradas no backend/edge functions, se aplicável

## 3. Dados e Papéis (Homologação)
- [ ] Usuário SUPER_ADMIN verificado
- [ ] Usuário ADMIN verificado
- [ ] Usuário TEACHER verificado
- [ ] Usuário STUDENT verificado
- [ ] Usuário GUARDIAN verificado
- [ ] Mínimo de duas instituições cadastradas
- [ ] Isolamento de dados entre instituições (RLS) confirmado

## 4. Infraestrutura Adicional
- [ ] Edge Functions implantadas e funcionais
- [ ] Acesso ao Console do banco/hospedagem para logs de erros
- [ ] Aba de Network monitorada sem vazamento de secrets ou chaves não publicáveis
- [ ] Rotina de backup ativada
- [ ] Plano de rollback documentado e testado

## 5. Status (Auditoria RLS)
### Tabelas com RLS documentada e ativada:
- accounts, institutions, profiles, memberships, students, guardianships, academic_years, classes, subjects, enrollments, subject_offerings, terms, assessments, grades, attendance_sessions, attendance_records, academic_policies, term_closures, student_term_results
- Papéis contemplados: anon, authenticated, service_role, (funções postgres: user_has_role, current_user_is_super_admin)

### Riscos / Observações:
- `student_registration_counters` não possui política de leitura/escrita além de `service_policy`, sugerindo que é acessível e modificável apenas internamente/por service_role.
- `fix_students_guardianships_rls_recursion` (20260711192128) redefiniu políticas para evitar recursão infinita, o que mostra complexidade de isolamento requerendo monitoramento.
- Algumas políticas de `delete` e `insert` foram encontradas, mas exigem validação funcional durante a homologação.
- As migrations mostram divergências aparentes devido às correções de RLS iterativas (20260710000300 vs 20260711000300 vs 20260711192128 vs 20260712...). Recomendado snapshot e consolidação futura, mas sem modificações nesta branch.

# Runbook de Release

1. **Atualizar a branch principal**
   - Garantir que a `main` possui os commits mais recentes aprovados (incluindo correções da homologação).

2. **Preparar e Validar**
   - Executar `npm ci` para instalar as dependências de forma exata.
   - Executar `npm run check` para rodar lint, typecheck, testes unitários e garantir que o build de produção passa localmente.

3. **Configuração de Ambiente no Provedor (ex: Vercel/Netlify)**
   - Configurar a variável `VITE_SUPABASE_URL` no painel.
   - Configurar a variável `VITE_SUPABASE_PUBLISHABLE_KEY` no painel.
   - *Aviso:* Não incluir valores de secrets em código.

4. **Build e Deploy**
   - Executar o comando de build configurado no provedor (ou localmente via `npm run build` caso o deploy seja manual).
   - Publicar a pasta `dist` gerada.
   - Garantir que a configuração do provedor possua o fallback de rotas SPA (ex: redirecionamento para `index.html` via `vercel.json` ou equivalente).

5. **Ajustes Remotos Pós-Deploy**
   - Realizar o "smoke test" acessando a URL pública providenciada pelo provedor.
   - *Somente após coordenação* com o desenvolvedor responsável pela homologação e configuração de DNS:
     - Configurar **Site URL** no Supabase.
     - Configurar **Redirect URLs** adicionais no Supabase.
     - Configurar **APP_URL** na Edge Functions / ambiente, se aplicável.

6. **Validação Final**
   - Testar o fluxo de Convite no ambiente de produção.
   - Testar o fluxo de Recuperação de Senha, certificando-se de que os links de email redirecionam adequadamente para o frontend hospedado.

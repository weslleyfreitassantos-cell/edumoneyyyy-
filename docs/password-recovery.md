# Recuperacao de senha

## Rotas

- Solicitacao: `/forgot-password`
- Callback e definicao da nova senha: `/auth/reset-password`

## Solicitacao

A tela publica chama `supabase.auth.resetPasswordForEmail` com redirect para
`/auth/reset-password` na origem atual da aplicacao. A mensagem exibida apos a
solicitacao e generica para evitar enumeracao de usuarios:

> Se o e-mail estiver cadastrado, enviaremos as instrucoes para redefinir sua
> senha.

## Formatos de link suportados

A rota `/auth/reset-password` aceita:

- `?token_hash=...&type=recovery`, validado com `verifyOtp`;
- `#access_token=...&refresh_token=...&type=recovery`, validado com
  `setSession`;
- evento `PASSWORD_RECOVERY` quando emitido pelo cliente Supabase.

Tipos diferentes de `recovery`, incluindo `invite`, sao rejeitados nessa rota.
O fluxo de convite continua em `/auth/confirm`.

## Seguranca da sessao

Tokens recebidos pela URL sao removidos em sucesso e erro. O fluxo guarda em
`sessionStorage` apenas um contexto temporario nao sensivel com `userId`,
`email`, `verifiedAt` e `purpose: "recovery"` para permitir refresh durante a
definicao da senha. Esse contexto e limpo apos sucesso ou erro de validacao.

Depois de atualizar a senha com `supabase.auth.updateUser`, a aplicacao encerra
a sessao local e orienta o usuario a voltar ao login:

> Senha atualizada com sucesso. Agora voce pode entrar usando sua nova senha.

## Configuracao externa pendente

Antes de testar envio real em staging/producao, confirmar no Supabase:

- a URL `/auth/reset-password` nos redirects permitidos;
- `Site URL`;
- template de recuperacao de senha apontando para o callback da aplicacao;
- SMTP;
- envio real e abertura do link recebido.

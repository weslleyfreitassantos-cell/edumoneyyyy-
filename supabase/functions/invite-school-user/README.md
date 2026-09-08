# School access email

The function sends institution-branded access messages through Resend.

Required Edge Function secrets:

- `resendsenha`: the existing Resend API key.
- `EMAIL_FROM`: a verified sender in the Resend account, for example `Escola Luz <acesso@escola-luz.grupotec.dev.br>`.

The generated password exists only in memory while the Auth user is created and the email is sent. It is never returned to the browser, stored in application tables or metadata, or written to logs.

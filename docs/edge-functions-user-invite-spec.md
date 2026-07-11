# Edge Function de convite escolar

## Funcao implementada

- Nome: `invite-school-user`
- Caminho local: `supabase/functions/invite-school-user/index.ts`
- Status de deploy: **NAO DEPLOYADA**

## Roles suportadas

Somente roles reais do enum atual:

- `DIRECTOR`
- `TEACHER`
- `STUDENT`
- `GUARDIAN`

`SECRETARY`, `SCHOOL_ADMIN` e `SUPER_ADMIN` continuam planejadas e nao sao
aceitas pela funcao.

## Autorizacao

- O request precisa ter bearer token valido.
- A funcao consulta a membership ativa do solicitante na `institutionId`.
- Apenas `ADMIN` ou `DIRECTOR` ativos podem criar convites escolares.
- Apenas `ADMIN` ativo pode convidar `DIRECTOR`.
- A role enviada pelo frontend nunca e usada como autoridade do solicitante.

## Payload

```json
{
  "institutionId": "uuid",
  "role": "DIRECTOR | TEACHER | STUDENT | GUARDIAN",
  "fullName": "Nome completo",
  "email": "usuario@escola.com",
  "student": {
    "birthDate": "2010-05-20",
    "cpf": "12345678901"
  },
  "guardian": {
    "studentId": "uuid",
    "relationship": "Mae"
  }
}
```

`student` e obrigatorio somente para `STUDENT`. `guardian` e obrigatorio
somente para `GUARDIAN`.

## Resposta

Sucesso:

```json
{
  "success": true,
  "userId": "uuid",
  "profileId": "uuid",
  "membershipId": "uuid",
  "role": "TEACHER",
  "email": "usuario@escola.com",
  "invitationSent": true,
  "reusedExistingUser": false,
  "message": "Convite enviado e vinculo criado com sucesso."
}
```

Erro:

```json
{
  "success": false,
  "code": "MEMBERSHIP_ALREADY_ACTIVE",
  "message": "Este e-mail ja possui vinculo ativo equivalente nesta escola.",
  "fieldErrors": {
    "email": "E-mail ja vinculado a instituicao."
  }
}
```

## Dependencias para deploy futuro

- Validar `APP_URL`.
- Configurar no Supabase o template de "Invite User" usando estritamente a URL da rota autenticadora: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. Nunca redirecionar direto para `/set-password` no template para evitar falhas de contexto de sessão.
- Validar SMTP/Auth invite no projeto de staging.
- Reconciliar migrations e RLS antes de habilitar em producao.
- Executar testes de staging sem aplicar migrations remotamente a partir desta
  branch.

# Edge Function de convite escolar

## Funcao implementada

- Nome: `invite-school-user`
- Caminho local: `supabase/functions/invite-school-user/index.ts`
- Status de deploy: **NAO DEPLOYADA**

## Roles suportadas

Somente roles reais do enum atual:

- `DIRECTOR`
- `SECRETARY`
- `TEACHER`
- `STUDENT`
- `GUARDIAN`

`SCHOOL_ADMIN`, `ACCOUNT_ADMIN` e `SUPER_ADMIN` nao sao roles escolares de
destino aceitas pela funcao. `ADMIN` e usado apenas como papel efetivo do
solicitante autorizado.

`GUARDIAN` e o papel persistido no banco. `parent` e somente identificador de
apresentacao usado pela UI quando aplicavel.

## Autorizacao

- O request precisa ter bearer token valido.
- A funcao consulta a instituicao ativa, a conta vinculada e a membership ativa
  do solicitante na `institutionId`.
- `ADMIN` efetivo pode convidar `DIRECTOR`, `SECRETARY`, `TEACHER`, `STUDENT`
  e `GUARDIAN`.
- `DIRECTOR` pode convidar `SECRETARY`, `TEACHER`, `STUDENT` e `GUARDIAN`.
- `SECRETARY` pode convidar apenas `STUDENT` e `GUARDIAN`.
- A role enviada pelo frontend nunca e usada como autoridade do solicitante.

## Payload

```json
{
  "institutionId": "uuid",
  "role": "DIRECTOR | SECRETARY | TEACHER | STUDENT | GUARDIAN",
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

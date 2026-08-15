# Instalacao do gateway da escola

Este procedimento instala o gateway no computador que enxerga as cameras da
instituicao. Ele nao exige abrir portas no roteador e nao instala senha de
camera no navegador.

## Pre-requisitos

- Windows com Node.js LTS;
- `cloudflared` instalado e disponivel no `PATH`;
- MediaMTX e FFprobe instalados no computador do gateway;
- acesso de saida HTTPS para Supabase e Cloudflare;
- uma origem HTTPS publicada da aplicacao.

## Parear

1. Na tela **Cameras ao vivo**, crie o gateway e copie o codigo de pareamento.
2. No computador da escola, execute:

```powershell
npm run camera-gateway -- pair `
  --code CODIGO_DE_PAREAMENTO `
  --supabase-url https://PROJETO.supabase.co `
  --anon-key CHAVE_PUBLICA
```

O codigo e de uso unico. O arquivo de configuracao fica no perfil do operador
em `%APPDATA%\EduManager\camera-gateway\config.json`.

## Preparar o relay

Execute uma vez, no mesmo computador pareado:

```powershell
npm run camera-gateway -- provision-relay
```

O backend cria ou reutiliza o tunnel exclusivo do gateway e devolve o token
somente para o processo local por HTTPS. O token e gravado em:

```text
%APPDATA%\EduManager\camera-gateway\cloudflared-tunnel.token
```

Esse arquivo nao deve ser enviado, copiado para o frontend ou incluido em
backup compartilhado. O acesso Cloudflare usado pelo backend fica somente nos
secrets da Edge Function.

## Iniciar

Use a origem exata do frontend publicado. Para a escola Tec Escola:

```powershell
npm run camera-gateway -- start `
  --allowed-origin https://tecescola.grupotec.dev.br
```

Para outra instalacao, substitua a origem pelo dominio HTTPS correspondente.
Nao use `--allowed-origin *`.

O painel deve mostrar duas condicoes independentes:

- **Gateway**: computador local pareado e com heartbeat;
- **Relay HTTPS**: tunnel conectado e com heartbeat recente.

Somente quando ambas estiverem online a sessao HLS remota recebe uma URL
`https://camera-gw-...grupotec.dev.br/...`. Se o relay estiver offline, o
painel mostra o estado indisponivel e nao tenta carregar `http://localhost`.

## Teste minimo

1. Cadastre uma webcam de laboratorio ou camera IP sem senha no navegador.
2. Confirme `Gateway online` e `Relay HTTPS online`.
3. Abra **Visualizar** em uma janela HTTPS fora da rede local.
4. Verifique no Network que o playback usa somente `https://gw-...`.
5. Verifique que nao existem erros Mixed Content, 401 inesperados ou loop de
   requisicoes.

Para diagnosticar sem expor segredo:

```powershell
npm run camera-gateway -- status
npm run camera-gateway -- test-camera --camera-id ID_DA_CAMERA
```

Nunca cole tokens, cookies, Authorization ou o conteudo do arquivo de token em
relatorios.

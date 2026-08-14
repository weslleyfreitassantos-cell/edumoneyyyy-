# Runtime do Camera Gateway

O runtime fica separado do React em `camera-gateway/` e representa uma unica instituicao por processo.

## Pareamento

O Diretor gera um codigo de uso unico na tela **Cameras ao vivo**. O operador executa:

```powershell
npm run camera-gateway -- pair --code CODIGO --supabase-url https://PROJETO.supabase.co --anon-key CHAVE_PUBLICA
```

O gateway chama a Edge Function `camera-gateway` com a acao `pair`. A funcao usa o service role somente no ambiente de backend para consumir a RPC de pareamento; o processo local recebe apenas um token opaco revogavel. O token fica em `%APPDATA%\EduManager\camera-gateway\config.json`.

## Ciclo do processo

- `start`: heartbeat a cada 25 segundos e sync a cada 30 segundos;
- `status`: mostra apenas estado e IDs, nunca tokens;
- `test-camera ID`: usa FFprobe com RTSP/TCP e retorna codec, dimensoes, FPS e audio;
- `logout`: remove a configuracao local e o token do gateway.

As acoes cloud sao `pair`, `heartbeat`, `sync` e `redeem_stream_session`. Todas as acoes autenticadas usam `Authorization: Bearer <gateway-token>`, um `request_id` unico e uma expiracao curta. O banco rejeita token invalido, request expirado e replay do mesmo request.

## Stream local

O gateway publica fontes RTSP autorizadas em um caminho interno do MediaMTX e oferece um proxy HLS local com sessao temporaria. O proxy:

- aceita somente origens locais configuradas;
- nao aceita caminho upstream vindo do browser;
- nao aceita URL com usuario ou senha;
- revalida a sessao no backend e respeita o TTL;
- reescreve playlists e segmentos sem entregar RTSP ao React.

Chrome usa `hls.js`; Safari pode usar HLS nativo. O modo local requer browser e gateway na mesma rede. O relay remoto ainda nao existe e a interface deve informar isso, sem exibir falso video.

Quando o frontend for aberto pelo IP da LAN, iniciar o gateway com uma origem explicitamente permitida, por exemplo `npm run camera-gateway -- start --allowed-origin http://192.168.1.108:3000`. O proxy nao aceita `*`.

## Laboratorio Windows

```powershell
.\scripts\cameras\start-full-camera-lab.ps1
.\scripts\cameras\stop-full-camera-lab.ps1
```

O laboratorio registra somente os PIDs que iniciou. A webcam e apenas uma fonte de teste; a mesma interface de publisher aceita RTSP generico para Intelbras/NVR. O contrato `camera-gateway/src/onvif.ts` prepara um adaptador ONVIF futuro sem discovery automatico ou network scan nesta versao.

## Servico futuro

Nesta primeira versao o processo e iniciado pelo usuario. Para operar como Windows Service ou Task Scheduler, usar o wrapper `scripts/cameras/gateway-start.ps1` e manter a configuracao no perfil do usuario. Nenhuma instalacao administrativa e feita automaticamente.

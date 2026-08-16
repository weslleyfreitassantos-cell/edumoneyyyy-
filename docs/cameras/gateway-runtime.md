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

As acoes cloud sao `pair`, `heartbeat`, `relay_heartbeat`, `provision_relay`,
`sync` e `redeem_stream_session`. Todas as acoes autenticadas usam
`Authorization: Bearer <gateway-token>`, um `request_id` unico e uma expiracao
curta. O banco rejeita token invalido, request expirado e replay do mesmo
request.

## Stream local

O gateway publica fontes RTSP autorizadas em um caminho interno do MediaMTX e oferece
proxies WebRTC/WHEP e HLS com sessao temporaria. O WebRTC e tentado primeiro para
baixa latencia; o HLS permanece como fallback automatico. O proxy:

- aceita somente origens locais configuradas;
- nao aceita caminho upstream vindo do browser;
- nao aceita URL com usuario ou senha;
- revalida a sessao no backend e respeita o TTL;
- reescreve playlists e segmentos sem entregar RTSP ao React.
- encaminha a negociacao WHEP com `POST`, `PATCH` e `DELETE` sem expor a porta 8889;
- mantem o token temporario da sessao para WebRTC e HLS no mesmo escopo da camera.

MediaMTX usa `:8889` para WHEP e `:8888` para HLS. Chrome, Edge e Safari tentam
WebRTC quando o navegador oferece `RTCPeerConnection`; se ICE, WHEP ou a rede
falharem, o player usa `hls.js` ou HLS nativo. O modo local requer browser e
gateway na mesma rede. Em producao, o relay remoto usa HTTPS e a interface nao
exibe video enquanto o relay nao estiver online.

O relay deve receber a origem da aplicacao em `CAMERA_GATEWAY_ALLOWED_ORIGINS`.
Em producao, use somente a origem HTTPS publicada, por exemplo
`https://tecescola.grupotec.dev.br`; nunca use `*`. O browser fala apenas com o
relay HTTPS. As portas locais `8554`, `8888` e `8889` ficam restritas ao gateway.

WebRTC remoto pode precisar de STUN/TURN para atravessar NAT. Credenciais TURN,
quando adicionadas, devem ser temporarias e entregues pela sessao autenticada;
nenhum segredo permanente deve ir para o frontend. O Cloudflare Tunnel transporta
o controle HTTPS do relay, mas nao substitui TURN para a midia WebRTC.

### TURN gerenciado

A Edge Function `camera-turn-credentials` valida o usuario e a sessao temporaria
da camera antes de pedir credenciais de curta duracao ao Cloudflare Realtime TURN.
Ela filtra endpoints alternativos que usam a porta 53 e retorna somente `iceServers`
temporarios ao navegador. O backend precisa dos secrets `CLOUDFLARE_TURN_KEY_ID`
e `CLOUDFLARE_TURN_API_TOKEN`; eles nao podem ser adicionados ao `.env` do frontend,
ao bundle ou ao gateway local. O API token do Cloudflare deve ter apenas a
permissao necessaria para gerar credenciais TURN. Sem esses secrets, o player
continua usando HLS e informa que a conectividade remota WebRTC ainda nao esta
configurada.

Quando o frontend for aberto pelo IP da LAN, iniciar o gateway com uma origem
explicitamente permitida, por exemplo `npm run camera-gateway -- start
--allowed-origin http://192.168.1.108:3000`. O proxy nao aceita `*`.

## Operacao remota por escola

O relay remoto e individual por gateway. O operador pode preparar o tunnel com:

```powershell
npm run camera-gateway -- provision-relay
```

Em seguida, o `start` inicia o `cloudflared` usando o token salvo localmente:

```powershell
npm run camera-gateway -- start --allowed-origin https://DOMINIO-PUBLICADO
```

O `cloudflared` faz somente conexao de saida para a Cloudflare e encaminha o
hostname HTTPS do gateway para `127.0.0.1:8787`. O processo local continua
protegendo as rotas por sessao curta, origem permitida, gateway pareado e
instituicao. Nunca configure o frontend para apontar para `localhost` quando a
pagina estiver em HTTPS.

## Laboratorio Windows

```powershell
.\scripts\cameras\start-full-camera-lab.ps1
.\scripts\cameras\stop-full-camera-lab.ps1
```

O laboratorio registra somente os PIDs que iniciou. A webcam e apenas uma fonte de teste; a mesma interface de publisher aceita RTSP generico para Intelbras/NVR. O contrato `camera-gateway/src/onvif.ts` prepara um adaptador ONVIF futuro sem discovery automatico ou network scan nesta versao.

## Servico futuro

Nesta primeira versao o processo e iniciado pelo usuario. Para operar como Windows Service ou Task Scheduler, usar o wrapper `scripts/cameras/gateway-start.ps1` e manter a configuracao no perfil do usuario. Nenhuma instalacao administrativa e feita automaticamente.

# Camera Gateway local

Runtime Windows em Node/TypeScript para uma instituicao por processo.

## Fluxo

1. O Diretor gera um codigo na tela **Cameras ao vivo**.
2. O operador executa `npm run camera-gateway -- pair --code CODIGO --supabase-url URL --anon-key CHAVE_PUBLICA`.
3. O gateway salva somente seu token opaco em `%APPDATA%\EduManager\camera-gateway\config.json`.
4. `npm run camera-gateway -- start` mantem heartbeat, sincroniza cameras da propria instituicao e oferece HLS local com sessao temporaria.

O token do gateway e as configuracoes de camera nunca entram no bundle React. Senhas de cameras ainda nao sao suportadas; o gateway rejeita fontes RTSP com credenciais.

## Modos

- Local: o browser e o gateway precisam estar na mesma rede. Use `--local-url http://IP-PRIVADO:8787` para acesso por outro dispositivo; o gateway faz bind apenas em loopback ou interfaces locais.
- Para o proxy WebRTC/WHEP e HLS no navegador, informe as origens permitidas, por exemplo `--allowed-origin http://192.168.1.108:3000` ou defina `CAMERA_GATEWAY_ALLOWED_ORIGINS`. Nunca use `*`.
- Remoto: use o relay HTTPS provisionado para o gateway. O processo local abre a conexao de saida com `cloudflared`; nenhuma porta do roteador precisa ser publicada.

## Relay HTTPS remoto

Depois do pareamento, execute `npm run camera-gateway -- provision-relay` uma vez
no computador da escola. O comando conversa com a Edge Function autenticada,
cria ou reutiliza o tunnel individual do gateway, grava o token do tunnel em
`%APPDATA%\EduManager\camera-gateway\cloudflared-tunnel.token` e nunca imprime o
token.

Inicie o processo permitindo somente a origem HTTPS publicada:

```powershell
npm run camera-gateway -- start --allowed-origin https://tecescola.grupotec.dev.br
```

O relay usa um hostname como
`https://camera-gw-<public-id-sem-gw->.grupotec.dev.br`. A URL de playback so e emitida
quando o gateway local e o relay estao online; sem relay configurado, uma pagina
HTTPS nao recebe URL `localhost` ou HTTP. O campo **Gateway** indica a conexao
local e **Relay HTTPS** indica a conexao remota separadamente. O gateway encaminha
o handshake WHEP para o MediaMTX local na porta `8889`; essa porta nunca deve ser
publicada na internet. O HLS em `8888` permanece como fallback.

O token Cloudflare e segredo operacional do gateway. Nao o coloque no frontend,
em `localStorage`, em URL, em logs ou no repositorio.

## Laboratorio

Use `scripts/cameras/start-full-camera-lab.ps1` e `stop-full-camera-lab.ps1`. O script nao mata processos fora dos PIDs registrados pelo proprio laboratorio.

O gateway nao e servico Windows nesta versao; a documentacao de servico/Task Scheduler pode ser adicionada depois.

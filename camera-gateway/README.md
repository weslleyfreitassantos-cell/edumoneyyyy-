# Camera Gateway local

Runtime Windows em Node/TypeScript para uma instituicao por processo.

## Fluxo

1. O Diretor gera um codigo na tela **Cameras ao vivo**.
2. O operador executa `npm run camera-gateway -- pair --code CODIGO --supabase-url URL --anon-key CHAVE_PUBLICA`.
3. O gateway salva somente seu token opaco em `%APPDATA%\EduManager\camera-gateway\config.json`.
4. `npm run camera-gateway -- start` mantem heartbeat, sincroniza cameras da propria instituicao e oferece HLS local com sessao temporaria.

O token do gateway e as configuracoes de camera nunca entram no bundle React. Senhas de cameras ainda nao sao suportadas; o gateway rejeita fontes RTSP com credenciais.

## Modos

- Local: o browser e o gateway precisam estar na mesma rede. O HLS local e permitido somente para loopback/RFC1918.
- Remoto: ainda nao implementado. A interface deve mostrar relay remoto indisponivel, sem fingir que existe video.

## Laboratorio

Use `scripts/cameras/start-full-camera-lab.ps1` e `stop-full-camera-lab.ps1`. O script nao mata processos fora dos PIDs registrados pelo proprio laboratorio.

O gateway nao e servico Windows nesta versao; a documentacao de servico/Task Scheduler pode ser adicionada depois.

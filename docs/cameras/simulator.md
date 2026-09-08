# Simulador de câmeras

O fluxo local é:

```text
FFmpeg/testpattern -> MediaMTX -> gateway local -> WebRTC/HLS seguro -> navegador
```

O navegador nunca recebe `rtsp://`, usuário, senha ou URL com credenciais. Em ausência de heartbeat, a interface exibe **Gateway não conectado**; não há estado online artificial.

Pré-requisitos opcionais: Docker Desktop em execução para MediaMTX e FFmpeg para gerar o padrão de teste. O laboratório não é necessário para rodar os testes automatizados.

Para iniciar:

```powershell
.\scripts\cameras\start-camera-lab.ps1 -Mode testpattern
```

Para um arquivo:

```powershell
.\scripts\cameras\start-camera-lab.ps1 -Mode file -InputPath .\sample.mp4
```

O arquivo de mídia não deve ser commitado. O gateway real deve consumir o RTSP na rede local e publicar somente uma sessão HTTPS WebRTC/HLS autorizada.

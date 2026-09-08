# Laboratorio local de cameras

O laboratorio usa MediaMTX e FFmpeg apenas para simular uma origem RTSP local. A origem nunca e enviada ao navegador e nenhum segredo de camera e salvo pelo script.

```powershell
.\scripts\cameras\start-camera-lab.ps1
.\scripts\cameras\stop-camera-lab.ps1
```

Modos disponiveis: `testpattern` (padrao), `file -InputPath caminho.mp4` e `webcam -WebcamIndex 0` ou `-WebcamName 'Nome do dispositivo DirectShow'`. No modo webcam, o indice e resolvido para o nome real do dispositivo antes de iniciar o FFmpeg.

Para iniciar o fluxo completo com MediaMTX, webcam e gateway pareado:

```powershell
.\scripts\cameras\start-full-camera-lab.ps1
.\scripts\cameras\stop-full-camera-lab.ps1
```

Os scripts registram e encerram somente os PIDs que iniciaram. Eles nao instalam binarios, nao iniciam o app e nao alteram o Supabase.

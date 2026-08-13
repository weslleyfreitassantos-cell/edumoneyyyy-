# Laboratório local de câmeras

O laboratório usa MediaMTX e FFmpeg apenas para simular uma origem RTSP local. A origem nunca é enviada ao navegador e nenhum segredo de câmera é salvo pelo script.

```powershell
.scriptscamerasstart-camera-lab.ps1
.scriptscamerasstop-camera-lab.ps1
```

Modos disponíveis: `testpattern` (padrão), `file -InputPath caminho.mp4` e `webcam -WebcamIndex 0`. O script não instala binários, não inicia o app e não altera o Supabase.

# Teste rápido no Windows

1. Abra o Docker Desktop.
2. Confirme `docker version` e `ffmpeg -version`.
3. Execute `.\scripts\cameras\start-camera-lab.ps1`.
4. Cadastre uma câmera IP com host local e associe o gateway criado pela RPC de pairing.
5. Verifique que o cartão permanece **Gateway não conectado** até o heartbeat do adaptador.
6. Encerre com `.\scripts\cameras\stop-camera-lab.ps1`.

Não cole tokens, senhas, URLs RTSP ou cookies em issues, logs ou relatórios.

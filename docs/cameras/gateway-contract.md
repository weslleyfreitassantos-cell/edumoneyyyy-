# Contrato do gateway local

O gateway é um processo local por instituição. Ele recebe a configuração de câmera sem expor a credencial ao browser, armazena o segredo apenas no cofre local e mantém heartbeat com o registro `camera_gateways`.

Eventos mínimos:

- `PAIR`: código temporário de 15 minutos, trocado uma única vez por um token do gateway;
- `HEARTBEAT`: usa somente o token do gateway e atualiza `last_seen_at` e `ONLINE`;
- `OFFLINE`: o frontend considera o gateway indisponível após a janela de heartbeat;
- `SESSION`: cria uma sessão HTTPS WebRTC/HLS curta para um DIRECTOR.

O contrato não autoriza responsáveis, não suporta áudio, gravação ou download e nunca aceita URL arbitrária para reprodução.

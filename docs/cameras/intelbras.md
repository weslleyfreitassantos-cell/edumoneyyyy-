# Integração Intelbras/ONVIF

O cadastro do EduManager guarda apenas metadados: fabricante, modelo, host, porta, protocolo, canal e perfil. A credencial deve ser provisionada no gateway local, preferencialmente usando o cofre do gateway.

O adaptador pode usar ONVIF para descoberta e RTSP para ingestão local. Ele deve:

1. validar o host na rede local;
2. nunca retornar usuário ou senha para o frontend;
3. enviar heartbeat assinado ao gateway;
4. publicar uma sessão WebRTC/HLS HTTPS curta e autorizada;
5. marcar o gateway como `OFFLINE` quando o heartbeat vencer.

O EduManager não testa IPs privados no cloud e não abre conexão RTSP diretamente.

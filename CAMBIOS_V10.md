# Galaxy Combat V10

## Cambios incluidos

- Tres controles moviles: **INCLINAR**, **BOTONES** y **JOYSTICK**.
- Aviso **GIRA EL MOVIL** durante la partida si el dispositivo esta en vertical.
- Intento de pantalla completa y bloqueo horizontal cuando el navegador lo permite.
- Los controles humanos del servidor caducan tras **300 ms** sin recibir una actualizacion.
- Un mismo WebSocket no puede crear o unirse a varias salas simultaneamente.
- WebSocket endurecido con `maxPayload` de 32 KB, validacion de origen y limites de frecuencia.
- Limite adicional de creacion de salas por IP.
- TURN configurable mediante `/rtc-config`.
- PWA: `manifest.webmanifest`, service worker, iconos y modo `fullscreen/landscape`.
- Cliente dividido en `audio.js`, `input.js`, `network.js`, `render.js`, `hud.js` y `game.js`.
- Servidor dividido en `server.js`, `room.js`, `physics.js`, `gameplay.js`, `network.js`, `security.js` y `transport.js`.

## TURN en Render

La voz sigue funcionando con STUN si no configuras TURN. Para activar el relay TURN, crea estas variables de entorno en Render:

- `TURN_URL` (o `TURN_URLS`, separado por comas)
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

Ejemplo de URL: `turns:turn.tudominio.com:5349`.

Las credenciales no se guardan en el repositorio. El navegador las obtiene desde `GET /rtc-config`.

## Origenes permitidos

Por defecto el WebSocket acepta la web publicada desde:

`https://jorgeslope73-debug.github.io`

Tambien permite `localhost` y `127.0.0.1` para desarrollo. Si publicas el juego en otro dominio, define en Render:

`ALLOWED_ORIGINS=https://tu-dominio.es,https://otro-dominio.es`

## Archivos nuevos principales

### Cliente
- `docs/input.js`
- `docs/network.js`
- `docs/audio.js`
- `docs/render.js`
- `docs/hud.js`
- `docs/pwa.js`
- `docs/sw.js`
- `docs/manifest.webmanifest`
- `docs/assets/icons/icon-192.png`
- `docs/assets/icons/icon-512.png`

### Servidor
- `server/room.js`
- `server/physics.js`
- `server/gameplay.js`
- `server/network.js`
- `server/security.js`
- `server/transport.js`

## Despliegue

Esta version cambia tanto cliente como servidor. Para que funcionen todas las mejoras debes subir el proyecto completo y volver a desplegar el servicio de Render.

# Galaxy Combat Web — V10

Juego web multijugador para PC, móvil y tablet.

## Estructura

- `docs/` — cliente web para GitHub Pages/PWA.
- `server/` — servidor Node.js + WebSocket autoritativo.
- `render.yaml` — configuración de despliegue del backend en Render.
- `CAMBIOS_V10.md` — cambios y configuración de esta versión.

## Cliente

El cliente está dividido en módulos:

- `game.js` — estado general y coordinación.
- `input.js` — teclado y controles móviles.
- `network.js` — conexión WebSocket.
- `audio.js` — música y efectos.
- `hud.js` — HUD de jugadores.
- `render.js` — utilidades de render/interpolación.
- `voz.js` — voz WebRTC.
- `pwa.js` / `sw.js` — instalación PWA y caché.

### Controles móviles

Hay tres modos seleccionables desde el menú:

- **INCLINAR** — inclinación para girar, izquierda dispara, derecha acelera.
- **BOTONES** — botones de giro, disparo y aceleración.
- **JOYSTICK** — joystick izquierdo para girar/acelerar y botón derecho para disparar.

La selección se guarda en el dispositivo. En vertical aparece **GIRA EL MÓVIL** durante la partida. El juego intenta entrar en pantalla completa y bloquear horizontal cuando el navegador lo permite.

## Servidor

El servidor está dividido en:

- `server.js` — HTTP, configuración RTC y bucle principal.
- `room.js` — estado de la partida/sala.
- `physics.js` — constantes y utilidades físicas.
- `gameplay.js` — reglas/utilidades generales.
- `network.js` — protocolo WebSocket y salas.
- `security.js` — origen, payload y rate limits.
- `transport.js` — envío/broadcast de mensajes.

Los controles humanos caducan a los **300 ms** si dejan de llegar mensajes, evitando naves acelerando o disparando tras perder conexión/foco.

## Backend

`docs/config.js` debe apuntar al backend HTTPS:

```js
window.GALAXY_CONFIG = {
  serverUrl: 'https://galaxy-combat-web.onrender.com'
};
```

El cliente convierte HTTPS en WSS y usa `/ws`.

## TURN para voz

STUN funciona sin configuración adicional. Para añadir relay TURN en Render configura:

- `TURN_URL` o `TURN_URLS`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

El cliente obtiene la configuración desde `/rtc-config`.

## Orígenes permitidos

Por defecto se permite `https://jorgeslope73-debug.github.io` y localhost para desarrollo. Para otro dominio configura `ALLOWED_ORIGINS` en Render con una lista separada por comas.

## PWA

La carpeta `docs/` incluye manifest, service worker e iconos. En navegadores compatibles el juego puede instalarse como aplicación y abrirse en modo fullscreen/landscape.

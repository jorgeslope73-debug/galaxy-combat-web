# Galaxy Combat Web

Repositorio preparado para separar el juego web del servidor de partidas.

## Carpetas

- `docs/` — cliente web para GitHub Pages.
- `server/` — servidor Node.js + WebSocket de las partidas.
- `render.yaml` — despliegue opcional del backend en Render.
- `.github/workflows/pages.yml` — despliegue automático de `docs/` en GitHub Pages.

## Configuración necesaria

Antes de publicar, edita `docs/config.js` y pon la URL HTTPS del backend:

```js
window.GALAXY_CONFIG = {
  serverUrl: 'https://TU-SERVIDOR.example.com'
};
```

El juego convertirá automáticamente `https://` en `wss://` y usará `/ws`.


SERVIDOR GRATUITO EN REPOSO
- Si Render ha dormido el servicio, la web muestra "Despertando servidor".
- El navegador reintenta la conexión automáticamente cada pocos segundos.
- Los botones de jugar permanecen desactivados hasta que el servidor responde.
- Cuando aparece "Servidor conectado · listo para jugar", ya se puede crear o unir a una sala.
- No hace falta recargar la página manualmente.


## CONTROL MÓVIL

Al abrir el juego desde móvil se muestra **ACTIVAR CONTROL MÓVIL**.
En iPhone/iPad hay que aceptar el permiso de movimiento/orientación.

Durante la partida:
- inclinar el móvil a izquierda/derecha = giro de la nave;
- mantener pulsada la mitad izquierda = disparar;
- mantener pulsada la mitad derecha = acelerar;
- se admiten dos dedos a la vez para acelerar y disparar simultáneamente;
- el botón **RECALIBRAR GIRO** toma la posición actual como centro.

Se recomienda jugar con el teléfono en horizontal.


## Corrección de orientación
Se ha corregido el sentido visual de las naves en navegador: la rotación del sprite usa el signo equivalente a Pygame, de modo que al acelerar la nave avanza hacia su morro.

- Corregida la orientación visual de los PNG de las naves: ahora el morro coincide con la dirección real de avance.


## V15 - reconexion de partida

Si se corta el WebSocket durante una partida iniciada, el servidor conserva al jugador durante 30 segundos. El cliente usa un playerToken privado para recuperar automaticamente la misma nave, puntuacion, municion y mejoras. La sesion temporal tambien se guarda en sessionStorage para sobrevivir a una recarga breve de Safari.


## V16.4.7 - TURN opcional para voz

La voz mantiene los STUN de Google y puede usar un servidor TURN de respaldo.
El backend expone `/rtc-config` y solo incluye TURN cuando las tres variables
de entorno estan configuradas en Render:

- `TURN_URLS` (o `TURN_URL`) - una o varias URLs TURN separadas por comas.
- `TURN_USERNAME` - usuario TURN.
- `TURN_CREDENTIAL` - credencial TURN.

No se guardan credenciales TURN en el repositorio. Si faltan estas variables o
la peticion de configuracion falla, el cliente continua usando STUN de Google.

Ejemplo de `TURN_URLS`:

```text
turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
```

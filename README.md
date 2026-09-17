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

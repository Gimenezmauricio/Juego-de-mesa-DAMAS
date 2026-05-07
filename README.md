# Juego-de-mesa-DAMAS

Juego de tablero inspirado en damas clásicas con diseño moderno, IA de tres niveles, modo local y temporizador por turno.

## Archivos

- `index.html` — interfaz principal del juego.
- `style.css` — estilos modernos y responsive.
- `script.js` — lógica de juego, IA, sonidos y guardado en `localStorage`.
- `docker-compose.yml` — servidor simple para servir la aplicación en `localhost:8080`.

## Cómo ejecutar

### Opción 1: abrir directamente
Abre `index.html` con tu navegador moderno.

### Opción 2: con Docker Compose
Ejecuta:

```bash
docker compose up
```

Luego abre: `http://localhost:8080`

## Características

- Modo `Jugador vs Computadora` con niveles `Fácil`, `Medio` y `Difícil`.
- Modo `Multijugador local` para partida en la misma PC.
- Temporizador de 15 segundos por turno con advertencia visual.
- Sonidos para movimiento, captura y victoria.
- Selector de tema claro/oscuro y música de ambiente.
- Reglas originales con casillas especiales, piezas cargadas y evolución.
- Historial y estadísticas guardadas en `localStorage`.

# SUMA Landing + Asistente en Vivo

Landing page estatica con chat en vivo para orientacion sobre seguros en El Salvador.

## Estructura

- `index.html`
- `css/styles.css`
- `js/main.js`
- `server.js` (backend Node sin dependencias)
- `data/knowledge-es-sv.md` (base orientativa local)
- `assets/`

## Requisitos

- Node.js 18+

## Configuracion

1. Crea tu archivo `.env` a partir de `.env.example`.
2. Define `OPENAI_API_KEY` con tu clave real.
3. (Opcional) Ajusta `OPENAI_MODEL` y `PORT`.

## Ejecutar local

```bash
set -a
source .env
set +a
node server.js
```

Abre `http://localhost:4173`.

## Endpoints

- `POST /api/chat/session` crea sesion de chat
- `POST /api/chat/message` envia mensaje al asistente
- `GET /health` estado del servidor

## Personalizacion de SofIA

- Avatar: reemplaza `assets/sofia-avatar.svg` por la imagen oficial (mismo nombre o actualiza la ruta en `index.html`).
- Tono: en `js/main.js`, cambia `CHAT_UI_CONFIG.tone` a:
  - `formal` (default)
  - `cercano`
- Disparadores automaticos del pop-up: en `js/main.js` ajusta `CHAT_UI_CONFIG.autoOpen`:
  - `delayMs` (apertura por tiempo)
  - `scrollPercent` (apertura por avance de scroll)
  - `exitIntent` (apertura por intencion de salida en desktop)
  - `maxPerSession` (limite de aperturas por sesion)

## Alcance legal del asistente

- Respuestas orientativas, no dictamen legal vinculante.
- No sustituye revision contractual final.
- Casos complejos deben escalarse a asesoria humana.

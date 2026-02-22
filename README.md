# SUMA Landing + Asistente en Vivo

Landing page estatica con chat en vivo para orientacion sobre seguros en El Salvador.

## Estructura

- `index.html`
- `css/styles.css`
- `js/main.js`
- `server.js` (backend Node sin dependencias)
- `api/` (funciones serverless para Vercel)
- `data/knowledge-es-sv.md` (base orientativa local)
- `assets/`

## Requisitos

- Node.js 18+

## Configuracion

1. Crea tu archivo `.env` a partir de `.env.example`.
2. Define `OPENAI_API_KEY` con tu clave real.
3. Para formulario de contacto por correo, define:
   - `RESEND_API_KEY`
   - `CONTACT_TO_EMAIL`
   - `CONTACT_FROM_EMAIL`
4. (Opcional) Ajusta `OPENAI_MODEL` y `PORT`.

## Ejecutar local

```bash
set -a
source .env
set +a
node server.js
```

Abre `http://localhost:4173`.

## Deploy en Vercel

### Opcion A: Importando el repositorio en Vercel (recomendado)

1. En Vercel, crea un proyecto nuevo desde tu repo `jpacas/suma_seguros`.
2. En "Environment Variables", agrega:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (opcional, default: `gpt-4.1-mini`)
   - `RESEND_API_KEY`
   - `CONTACT_TO_EMAIL`
   - `CONTACT_FROM_EMAIL`
3. Deploy.

### Opcion B: Desde CLI

```bash
npx vercel
npx vercel --prod
```

Luego configura en Vercel las variables de entorno anteriores y vuelve a desplegar si hace falta.

## Endpoints

- `POST /api/chat/session` crea sesion de chat
- `POST /api/chat/message` envia mensaje al asistente
- `POST /api/contact` envia formulario de contacto por correo (incluye adjuntos)
- `GET /health` estado del servidor local (`server.js`)
- `GET /api/health` estado en Vercel (serverless)

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

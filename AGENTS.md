# AGENTD.md — SUMA / Landing Page Sofía (Codex 5.3)

> Nota: En la documentación oficial de Codex, el nombre estándar del archivo de instrucciones es **AGENTS.md** (y/o `AGENTS.override.md`). Codex lo lee antes de trabajar.  [oai_citation:0‡OpenAI Developers](https://developers.openai.com/codex/guides/agents-md/)  
> Si tu flujo específicamente pide **AGENTD.md**, úsalo igual, pero te recomiendo **duplicar este mismo contenido** en `AGENTS.md` para asegurar compatibilidad.

---

## Objetivo del trabajo
Construir una **landing page estática** (1 página) para **Sofía Pacas de Avelar** (SUMA – Asesoría en Seguros), enfocada en **conversión por WhatsApp**.

La landing debe reflejar la estrategia:
- **Respuesta inmediata 24/7** (Agente IA / atención automatizada)
- **Asesoría premium de Sofía** para casos complejos / empresas
- **Oferta gancho**: “Revisión gratuita de tu póliza en 15 minutos”
- Mensaje simple: “Seguros sin complicarte”

---

## Stack y restricciones
- **Frontend estático**: HTML + CSS + JS (sin frameworks).
- Puede usarse **Tailwind por CDN** si acelera el diseño (opcional).
- Tipografía recomendada: `Inter` (Google Fonts).
- Íconos: Material Icons por CDN (opcional).
- **Idioma**: Español.
- **CTA principal**: WhatsApp (link directo con mensaje prellenado).
- Mantener el diseño **minimalista**, rápido, mobile-first.

---

## Estructura de archivos esperada
Crear esta estructura:

- `/index.html`
- `/assets/`
  - `logo-suma.jpg` (usar el logo provisto por el usuario si existe en el repo; si no, crear placeholder y dejar TODO para reemplazarlo)
- `/css/`
  - `styles.css`
- `/js/`
  - `main.js`
- `/README.md` (cómo correr local)

No agregar dependencias ni build steps.

---

## Requisitos de diseño (UI/UX)
- **Mobile-first**: que se vea excelente en teléfono.
- Hero con 2 CTAs visibles sin scroll:
  1) **Cotizar por WhatsApp ahora** (principal)
  2) **Agendar 15 min (revisión de póliza)** (secundario, puede ser ancla a sección o WhatsApp con keyword)
- Secciones bien “escaneables” (bullets, tarjetas, espacios).
- Accesibilidad:
  - buen contraste
  - botones grandes
  - labels claros
  - `alt` en imágenes
- Performance:
  - imágenes optimizadas (si hay)
  - poco JS
  - evitar librerías pesadas

---

## Branding (colores y estilo)
Basarse en el logo:
- Fondo principal recomendado: **oscuro** (negro/gris muy oscuro) con secciones claras alternas, o diseño claro con acentos naranjas.
- Color acento primario: **naranja** (aprox. #F28C1B; ajustar visualmente).
- Tipografía: Inter o sistema.

Mantener acento naranja para:
- botones principales
- highlights
- íconos clave

---

## Contenido obligatorio (secciones y copy)
### 1) Header / Navbar (simple)
- Logo SUMA
- Links ancla: Servicios, Cómo funciona, Revisión de póliza, FAQ
- Botón: “WhatsApp”

### 2) Hero (arriba)
**H1:** Seguros sin complicarte: respuesta inmediata 24/7 y asesoría personalizada  
**Sub:** En SUMA resolvés dudas al instante por WhatsApp y, si tu caso lo amerita, Sofía lo revisa personalmente.  
Bullets (3):
- Cotizá en minutos (vehículo, hogar, médicos, vida, empresas)
- Comparación clara de opciones (sin letras pequeñas)
- Acompañamiento en siniestros y renovaciones

CTAs:
- ✅ Cotizar por WhatsApp ahora
- 📄 Enviar mi póliza para revisión (15 min)

Microtexto: “Tu información es confidencial.”

### 3) “¿Qué te resolvemos hoy?” (tarjetas con CTA)
Tarjetas (5):
- Vehículo
- Gastos médicos
- Vida
- Hogar / Residencial
- Empresas

Cada tarjeta debe tener un botón que abre WhatsApp con mensaje prellenado.

### 4) Diferencial (dos canales)
Título: Dos formas de atenderte, una sola prioridad: protegerte bien  
Columna A: Atención inmediata 24/7 (IA/automatizado)  
Columna B: Revisión personal por Sofía (casos complejos/empresas/renovaciones)  
Cierre: “Rápido cuando lo necesitás. Personal cuando lo amerita.”

### 5) Cómo funciona (3 pasos)
1) Nos escribís por WhatsApp  
2) Pedimos lo mínimo y comparamos opciones  
3) Emitimos y te acompañamos (siniestros/renovación)

CTA intermedio: “Empezar por WhatsApp”

### 6) Oferta gancho: Revisión gratuita de póliza (muy visible)
Título: ¿Ya tenés póliza? Te la reviso en 15 minutos  
Bullets:
- si estás pagando de más
- si te falta cobertura clave
- ajustes recomendados

CTA: “Enviar póliza por WhatsApp”

### 7) Personas y Empresas (dos bloques)
**Personas y familias:** vehículo, GMM, vida, hogar  
**Empresas:** programas para empleados, flotillas, RC, propiedad (según giro)  
Cada bloque con CTA.

### 8) Confianza
Si no hay testimonios reales, usar “Compromisos de servicio”:
- Respuesta rápida
- Lenguaje simple
- Confidencialidad
- Acompañamiento en siniestros

### 9) FAQ (5 preguntas)
- ¿Cuánto tarda una cotización?
- ¿Trabajan con varias aseguradoras?
- ¿Me atienden en siniestros?
- ¿Puedo cambiar si ya tengo póliza?
- ¿La atención 24/7 es por WhatsApp?

### 10) CTA final
Título: Listo. Escribinos y resolvé tu seguro hoy.  
Botones: WhatsApp + Revisión de póliza

### 11) Footer
- SUMA – Asesoría en Seguros
- WhatsApp / correo
- “Atención automatizada 24/7”
- Nota legal corta: “Coberturas sujetas a términos y condiciones de cada aseguradora.”

---

## WhatsApp: enlaces y mensajes prellenados
Implementar links con `https://wa.me/<NUMERO>?text=<MENSAJE_URL_ENCODED>`

Dejar el número como constante editable en `main.js` y también en un comentario en `index.html`:
- `WHATSAPP_NUMBER = "503XXXXXXXX"` (placeholder)

Mensajes prellenados:
1) Vehículo: “Hola SUMA, quiero cotizar seguro de vehículo. Marca/modelo/año: ___”
2) GMM: “Hola SUMA, quiero opciones de gastos médicos. Edad: ___, busco cobertura para: ___”
3) Vida: “Hola SUMA, quiero seguro de vida. Dependen de mí: ___, presupuesto aprox: ___”
4) Hogar: “Hola SUMA, quiero asegurar mi casa/apto en ___. Deseo cobertura para ___”
5) Empresas: “Hola SUMA, necesito seguros para mi empresa. Somos ___ empleados y buscamos ___”
6) Revisión póliza: “Hola SUMA, quiero una revisión de mi póliza. Te comparto foto aquí.”

---

## Interacciones JS (mínimas)
- Smooth scroll a anclas
- Botones WhatsApp se generan/actualizan desde `main.js` usando la constante `WHATSAPP_NUMBER`
- No usar frameworks, no usar trackers

---

## Criterios de aceptación (checklist)
- [ ] La página carga y se ve bien en mobile y desktop.
- [ ] CTA principal visible sin scroll.
- [ ] Todos los botones abren WhatsApp con texto prellenado.
- [ ] Sección “Revisión gratuita de póliza” clara y destacada.
- [ ] Contenido completo en español y alineado con estrategia 24/7 + Sofía.
- [ ] Código limpio, comentado, sin dependencias.
- [ ] README con instrucciones para correr (abrir index.html o Live Server).

---

## Instrucciones para el agente (pasos sugeridos)
1) Crear estructura de carpetas y archivos.
2) Construir `index.html` con secciones y anclas.
3) Implementar `styles.css` (minimalista, responsive).
4) Implementar `main.js` para links de WhatsApp + smooth scroll.
5) Agregar el logo en `/assets/` (placeholder si no existe).
6) Validar en mobile (layout, spacing, botones).
7) Escribir `README.md`.

---

## Notas de contenido
- No inventar datos sensibles (teléfono real, dirección, números de licencia).
- Si falta el número de WhatsApp real, dejar placeholder visible y fácil de cambiar.
- Mantener tono profesional, claro y cercano.
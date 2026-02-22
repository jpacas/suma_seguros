const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL;
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL;
const ROOT = process.cwd();
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const sessions = new Map();
const MAX_TURNS = 12;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

const intentPrompts = {
  general: "Quiero orientacion general sobre seguros en El Salvador.",
  vehiculo: "Quiero orientacion inicial para seguro de vehiculo en El Salvador.",
  gmm: "Quiero orientacion inicial sobre seguro de gastos medicos.",
  vida: "Quiero orientacion inicial sobre seguro de vida.",
  hogar: "Quiero orientacion inicial para seguro de hogar/residencial.",
  empresas: "Quiero orientacion inicial sobre seguros para mi empresa.",
  revision: "Quiero revisar mi poliza actual para detectar brechas o sobrecostos.",
  escalar: "Necesito escalamiento a revision personalizada con Sofia."
};

let knowledgeBase = "";

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function readKnowledgeBase() {
  const kbPath = path.join(ROOT, "data", "knowledge-es-sv.md");
  try {
    knowledgeBase = await fsp.readFile(kbPath, "utf8");
  } catch {
    knowledgeBase = "Base local no disponible.";
  }
}

function getSystemPrompt() {
  return [
    "Eres el asistente de SUMA para seguros en El Salvador.",
    "Responde siempre en espanol.",
    "Habla en tono conversacional, claro y cercano-profesional.",
    "Tu rol es orientativo, no emites dictamen legal vinculante.",
    "No inventes leyes, articulos, ni datos regulatorios.",
    "Si no hay suficiente certeza, dilo con claridad y sugiere escalamiento.",
    "No hagas promesas absolutas de cobertura.",
    "Cuando detectes caso complejo legal/contractual, inicia la respuesta con la etiqueta [ESCALAR_A_SOFIA].",
    "Da respuestas claras, practicas y accionables.",
    "Regla estricta: responde en maximo 80 palabras salvo que el usuario pida mas detalle.",
    "Usa 2 a 4 oraciones cortas, sin listas largas.",
    "Haz una sola pregunta de seguimiento por turno, no varias a la vez.",
    "Si necesitas mas datos para ayudar, pide solo el siguiente dato minimo mas importante.",
    "Explicaciones largas solo si el usuario escribe explicitamente: 'explicalo en detalle'.",
    "Base de conocimiento interna:\n" + knowledgeBase
  ].join("\n");
}

function extractAssistantText(responseJson) {
  if (typeof responseJson.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  if (!Array.isArray(responseJson.output)) {
    return "No se pudo generar una respuesta en este momento.";
  }

  const parts = [];
  for (const item of responseJson.output) {
    if (!Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
      if (content.type === "text" && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim() || "No se pudo generar una respuesta en este momento.";
}

function userAskedForDetail(userMessage) {
  const text = String(userMessage || "").toLowerCase();
  return ["detalle", "detall", "explica", "paso a paso", "profund", "amplia", "completo"].some((token) =>
    text.includes(token)
  );
}

function toBriefConversationalReply(reply, userMessage) {
  if (!reply) return reply;
  if (userAskedForDetail(userMessage)) return reply;

  const compact = reply.replace(/\s+/g, " ").trim();
  if (compact.length <= 420) return compact;
  const hardLimit = 300;
  let brief = compact.slice(0, hardLimit);
  const lastSpace = brief.lastIndexOf(" ");
  if (lastSpace > 180) {
    brief = brief.slice(0, lastSpace);
  }
  brief = brief.replace(/[,:;\-]+$/, "").trim();
  return `${brief}. ¿Te parece si avanzamos con el siguiente dato clave?`;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        reject(new Error("Payload demasiado grande."));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON invalido."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => ({
      filename: String(item?.filename || "").trim(),
      contentType: String(item?.contentType || "application/octet-stream").trim(),
      data: String(item?.data || "").trim()
    }))
    .filter((item) => item.filename && item.data);
}

async function sendContactEmail({ name, phone, email, insuranceType, message, attachments }) {
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
    throw new Error("Falta configurar RESEND_API_KEY, CONTACT_TO_EMAIL o CONTACT_FROM_EMAIL.");
  }

  const lines = [
    "Nuevo formulario de contacto directo",
    "",
    `Nombre: ${name}`,
    `Telefono: ${phone}`,
    `Correo: ${email || "No compartido"}`,
    `Tipo de seguro: ${insuranceType}`,
    "",
    "Detalle del caso:",
    message
  ];

  const payload = {
    from: CONTACT_FROM_EMAIL,
    to: [CONTACT_TO_EMAIL],
    subject: `Nuevo contacto SUMA - ${insuranceType}`,
    text: lines.join("\n"),
    attachments: attachments.map((file) => ({
      filename: file.filename,
      content: file.data
    }))
  };

  if (email) {
    payload.reply_to = email;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = result?.message || result?.error || "No se pudo enviar el correo.";
    throw new Error(errorMessage);
  }
}

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada en el servidor.");
  }

  const formattedInput = messages.map((message) => {
    const isAssistant = message.role === "assistant";
    return {
      role: message.role,
      content: [
        {
          type: isAssistant ? "output_text" : "input_text",
          text: message.content
        }
      ]
    };
  });

  const payload = {
    model: OPENAI_MODEL,
    input: formattedInput
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const responseJson = await response.json();

  if (!response.ok) {
    const err = responseJson?.error?.message || "Error desconocido al consultar OpenAI.";
    throw new Error(err);
  }

  return responseJson;
}

async function serveFile(req, res) {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const cleanPath = path.normalize(decodeURIComponent(urlPath)).replace(/^\.+/, "");
  const requestedPath = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = path.join(ROOT, requestedPath);

  if (!filePath.startsWith(ROOT)) {
    json(res, 403, { error: "Ruta no permitida." });
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      json(res, 403, { error: "Directorio no permitido." });
      return;
    }
  } catch {
    json(res, 404, { error: "Archivo no encontrado." });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    json(res, 400, { error: "Request invalido." });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, model: OPENAI_MODEL, hasApiKey: Boolean(OPENAI_API_KEY) });
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat/session") {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, []);
    json(res, 200, { sessionId });
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat/message") {
    try {
      const body = await parseJsonBody(req);
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const intent = typeof body.intent === "string" ? body.intent : "general";

      if (!sessionId) {
        json(res, 400, { error: "sessionId es requerido." });
        return;
      }

      const baseMessage = intentPrompts[intent] || intentPrompts.general;
      const userMessage = message || baseMessage;
      const history = ensureSession(sessionId);

      history.push({ role: "user", content: userMessage });
      const trimmedHistory = history.slice(-MAX_TURNS * 2);

      const modelInput = [{ role: "system", content: getSystemPrompt() }, ...trimmedHistory];
      const openaiResponse = await callOpenAI(modelInput);
      let assistantText = extractAssistantText(openaiResponse);

      let escalate = false;
      if (assistantText.startsWith("[ESCALAR_A_SOFIA]")) {
        escalate = true;
        assistantText = assistantText.replace("[ESCALAR_A_SOFIA]", "").trim();
      }
      assistantText = toBriefConversationalReply(assistantText, userMessage);

      history.push({ role: "assistant", content: assistantText });
      sessions.set(sessionId, history.slice(-MAX_TURNS * 2));

      json(res, 200, { reply: assistantText, escalate });
    } catch (error) {
      json(res, 500, { error: error.message || "Error interno del servidor." });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/contact") {
    try {
      const body = await parseJsonBody(req);
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      const email = String(body.email || "").trim();
      const insuranceType = String(body.insuranceType || "").trim();
      const message = String(body.message || "").trim();
      const attachments = normalizeAttachments(body.attachments);

      if (!name || !phone || !insuranceType || !message) {
        json(res, 400, { error: "Faltan campos obligatorios." });
        return;
      }

      for (const file of attachments) {
        const sizeInBytes = Buffer.byteLength(file.data, "base64");
        if (sizeInBytes > MAX_ATTACHMENT_BYTES) {
          json(res, 400, { error: "Uno de los archivos supera el limite permitido (5 MB)." });
          return;
        }
      }

      await sendContactEmail({ name, phone, email, insuranceType, message, attachments });
      json(res, 200, { ok: true });
    } catch (error) {
      json(res, 500, { error: error.message || "No se pudo enviar la solicitud." });
    }
    return;
  }

  if (req.method === "GET") {
    await serveFile(req, res);
    return;
  }

  json(res, 405, { error: "Metodo no permitido." });
});

readKnowledgeBase().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
  });
});

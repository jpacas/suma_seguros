const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 4173);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const ROOT = process.cwd();

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
    "Tu rol es orientativo, no emites dictamen legal vinculante.",
    "No inventes leyes, articulos, ni datos regulatorios.",
    "Si no hay suficiente certeza, dilo con claridad y sugiere escalamiento.",
    "No hagas promesas absolutas de cobertura.",
    "Cuando detectes caso complejo legal/contractual, inicia la respuesta con la etiqueta [ESCALAR_A_SOFIA].",
    "Da respuestas claras, practicas y accionables.",
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

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
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

  const payload = {
    model: OPENAI_MODEL,
    input: messages.map((message) => ({
      role: message.role,
      content: [{ type: "input_text", text: message.content }]
    }))
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

      history.push({ role: "assistant", content: assistantText });
      sessions.set(sessionId, history.slice(-MAX_TURNS * 2));

      json(res, 200, { reply: assistantText, escalate });
    } catch (error) {
      json(res, 500, { error: error.message || "Error interno del servidor." });
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

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const sessions = new Map();
const MAX_TURNS = 12;

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

let knowledgeBaseCache = null;

async function getKnowledgeBase() {
  if (knowledgeBaseCache !== null) return knowledgeBaseCache;

  const kbPath = path.join(process.cwd(), "data", "knowledge-es-sv.md");
  try {
    knowledgeBaseCache = await fs.readFile(kbPath, "utf8");
  } catch {
    knowledgeBaseCache = "Base local no disponible.";
  }
  return knowledgeBaseCache;
}

async function getSystemPrompt() {
  const knowledgeBase = await getKnowledgeBase();
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

function createSessionId() {
  return crypto.randomUUID();
}

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  return sessions.get(sessionId);
}

function trimHistory(history) {
  if (history.length > MAX_TURNS) {
    const excess = history.length - MAX_TURNS;
    history.splice(0, excess);
  }
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

async function processChatTurn({ sessionId, message, intent }) {
  if (!sessionId) {
    throw new Error("sessionId es requerido.");
  }

  const history = ensureSession(sessionId);
  const userMessage = (typeof message === "string" && message.trim()) || intentPrompts[intent] || intentPrompts.general;

  history.push({ role: "user", content: userMessage });
  trimHistory(history);

  const systemPrompt = await getSystemPrompt();
  const messages = [{ role: "system", content: systemPrompt }, ...history];

  const responseJson = await callOpenAI(messages);
  const reply = extractAssistantText(responseJson);
  const escalate = reply.includes("[ESCALAR_A_SOFIA]");
  const cleanReply = toBriefConversationalReply(reply.replace("[ESCALAR_A_SOFIA]", "").trim(), userMessage);

  history.push({ role: "assistant", content: cleanReply || reply });
  trimHistory(history);

  return {
    reply: cleanReply || reply || "No se pudo generar una respuesta en este momento.",
    escalate
  };
}

function getModelInfo() {
  return {
    model: OPENAI_MODEL,
    hasApiKey: Boolean(OPENAI_API_KEY)
  };
}

module.exports = {
  createSessionId,
  processChatTurn,
  getModelInfo
};

const { processChatTurn } = require("../_lib/chat-core");
const { json, parseJsonBody } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Metodo no permitido." });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const message = typeof body.message === "string" ? body.message : "";
    const intent = typeof body.intent === "string" ? body.intent : "general";

    const result = await processChatTurn({ sessionId, message, intent });
    json(res, 200, result);
  } catch (error) {
    const status = error.message === "sessionId es requerido." ? 400 : 500;
    json(res, status, { error: error.message || "No se pudo completar la consulta." });
  }
};

const { createSessionId } = require("../_lib/chat-core");
const { json } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Metodo no permitido." });
    return;
  }

  const sessionId = createSessionId();
  json(res, 200, { sessionId });
};

const { getModelInfo } = require("./_lib/chat-core");
const { json } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    json(res, 405, { error: "Metodo no permitido." });
    return;
  }

  json(res, 200, { ok: true, ...getModelInfo() });
};

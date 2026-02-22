const { json, parseJsonBody } = require("./_lib/http");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL;
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Metodo no permitido." });
    return;
  }

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
};

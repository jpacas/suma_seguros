const CHAT_CONFIG = {
  sessionEndpoint: "/api/chat/session",
  messageEndpoint: "/api/chat/message",
  intents: {
    general: "Quiero orientacion general sobre seguros.",
    vehiculo: "Quiero informacion para seguro de vehiculo.",
    gmm: "Quiero informacion sobre seguro de gastos medicos.",
    vida: "Quiero informacion sobre seguro de vida.",
    hogar: "Quiero informacion sobre seguro de hogar.",
    empresas: "Quiero informacion sobre seguros para mi empresa.",
    revision: "Quiero revisar mi poliza actual.",
    escalar: "Necesito escalar mi caso para revision personalizada con Sofia."
  }
};

const CHAT_UI_CONFIG = {
  tone: "formal",
  autoOpen: {
    enabled: true,
    delayMs: 12000,
    scrollPercent: 45,
    exitIntent: true,
    maxPerSession: 1
  }
};

const chatState = {
  sessionId: null,
  busy: false,
  initialized: false,
  modalTimer: null,
  lastGreetingKey: "",
  autoOpenCount: 0
};

const CHAT_CONTEXT_COPY = {
  general: "Puedo ayudarte con coberturas, deducibles y comparacion de opciones para tu caso.",
  vehiculo: "Si deseas, empezamos por tipo de uso, marca/modelo y nivel de cobertura para vehiculo.",
  gmm: "Para gastos medicos, te guio por red hospitalaria, deducibles y limites recomendados.",
  vida: "En vida, puedo orientarte segun dependientes, plazo y objetivo de proteccion.",
  hogar: "Para hogar, revisamos cobertura de estructura, contenido y riesgos frecuentes.",
  empresas: "En empresas, puedo orientarte en RC, flotillas, propiedad y programas para colaboradores.",
  revision: "Para revision de poliza, te indico que informacion compartir para detectar brechas y sobrecostos.",
  escalar: "Tambien puedo preparar el caso para que Sofia lo revise personalmente."
};

function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((link) => {
    if (link.hasAttribute("data-chat-intent")) return;

    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;

      event.preventDefault();
      const header = document.querySelector(".site-header");
      const headerOffset = header ? header.offsetHeight + 8 : 0;
      const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    });
  });
}

function appendMessage(text, role = "assistant") {
  const messages = document.getElementById("chatMessages");
  if (!messages) return;

  const block = document.createElement("div");
  block.className = `msg msg-${role}`;
  block.textContent = text;
  messages.appendChild(block);
  messages.scrollTop = messages.scrollHeight;
}

function appendMetaMessage(text) {
  const messages = document.getElementById("chatMessages");
  if (!messages) return;

  const block = document.createElement("div");
  block.className = "msg msg-meta";
  block.textContent = text;
  messages.appendChild(block);
  messages.scrollTop = messages.scrollHeight;
}

function resolveSourceContext(element) {
  if (!element) return "esta pagina";
  const section = element.closest("section");
  if (!section) return "esta pagina";

  const title = section.querySelector("h2, h1");
  if (!title) return "esta pagina";
  return title.textContent.trim();
}

function appendContextGreeting(intent, sourceLabel) {
  const detail = CHAT_CONTEXT_COPY[intent] || CHAT_CONTEXT_COPY.general;
  const greetingKey = `${intent}:${sourceLabel}`;
  if (chatState.lastGreetingKey === greetingKey) return;

  appendMessage(`Veo que vienes de "${sourceLabel}". ${detail}`, "assistant");
  chatState.lastGreetingKey = greetingKey;
}

function getWelcomeMessage() {
  if (CHAT_UI_CONFIG.tone === "cercano") {
    return "Hola, soy SofIA. Estoy aqui para ayudarte con tus seguros en El Salvador, de forma simple y rapida.";
  }
  return "Hola. Soy SofIA, asistente virtual de SUMA. Puedo orientarte sobre polizas y seguros en El Salvador.";
}

function markAutoOpenCount(nextCount) {
  chatState.autoOpenCount = nextCount;
  try {
    sessionStorage.setItem("sofiaAutoOpenCount", String(nextCount));
  } catch (_error) {
    // Si sessionStorage no esta disponible, seguimos con estado en memoria.
  }
}

function getAutoOpenCount() {
  try {
    const stored = Number(sessionStorage.getItem("sofiaAutoOpenCount") || "0");
    if (Number.isFinite(stored) && stored >= 0) {
      chatState.autoOpenCount = stored;
    }
  } catch (_error) {
    chatState.autoOpenCount = 0;
  }
  return chatState.autoOpenCount;
}

function openByTrigger(triggerLabel) {
  if (!CHAT_UI_CONFIG.autoOpen.enabled) return;
  if (getAutoOpenCount() >= CHAT_UI_CONFIG.autoOpen.maxPerSession) return;

  const modal = document.getElementById("chatModal");
  if (!modal || !modal.hidden) return;

  openChatModal("Asistencia guiada");
  appendContextGreeting("general", `activacion automatica (${triggerLabel})`);
  appendMetaMessage("Puedes preguntar por vehiculo, hogar, vida, gastos medicos o empresa.");
  markAutoOpenCount(chatState.autoOpenCount + 1);
}

async function ensureSession() {
  if (chatState.sessionId) return chatState.sessionId;

  const response = await fetch(CHAT_CONFIG.sessionEndpoint, { method: "POST" });
  if (!response.ok) {
    throw new Error("No se pudo crear sesion de chat.");
  }

  const data = await response.json();
  chatState.sessionId = data.sessionId;
  return chatState.sessionId;
}

async function sendChatMessage(message, intent = "general") {
  if (chatState.busy) return;
  chatState.busy = true;

  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    const sessionId = await ensureSession();
    appendMessage(message, "user");
    appendMetaMessage("Escribiendo...");

    const response = await fetch(CHAT_CONFIG.messageEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message, intent })
    });

    const pending = document.querySelector(".msg-meta:last-child");
    if (pending && pending.textContent === "Escribiendo...") {
      pending.remove();
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Error de conexion." }));
      throw new Error(err.error || "No se pudo completar la consulta.");
    }

    const data = await response.json();
    appendMessage(data.reply || "No se genero respuesta.", "assistant");

    if (data.escalate) {
      appendMetaMessage("Tu caso puede requerir revision personalizada con Sofia.");
    }
  } catch (error) {
    appendMetaMessage(error.message || "Error inesperado. Intenta de nuevo.");
  } finally {
    chatState.busy = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

function openChatModal(contextLabel = "") {
  const modal = document.getElementById("chatModal");
  const input = document.getElementById("chatInput");
  const subtitle = document.getElementById("chatSubtitle");
  if (!modal) return;

  if (chatState.modalTimer) {
    clearTimeout(chatState.modalTimer);
    chatState.modalTimer = null;
  }

  modal.hidden = false;
  modal.classList.remove("is-open");
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => {
    modal.classList.add("is-open");
  });

  if (subtitle) {
    subtitle.textContent = contextLabel
      ? `Asistente virtual para seguros en El Salvador. Contexto: ${contextLabel}`
      : "Asistente virtual de SUMA para seguros en El Salvador";
  }
  if (input) input.focus();
}

function closeChatModal() {
  const modal = document.getElementById("chatModal");
  if (!modal) return;

  modal.classList.remove("is-open");
  chatState.modalTimer = window.setTimeout(() => {
    modal.hidden = true;
  }, 220);
  document.body.classList.remove("modal-open");
}

function initChatWidget() {
  const launcher = document.getElementById("chatLauncher");
  const closeActions = document.querySelectorAll("[data-chat-close]");
  if (launcher) {
    launcher.addEventListener("click", () => {
      openChatModal();
    });
  }

  closeActions.forEach((action) => {
    action.addEventListener("click", () => {
      closeChatModal();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeChatModal();
  });
}

function initChatForm() {
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  if (!form || !input) return;

  if (!chatState.initialized) {
    appendMessage(getWelcomeMessage(), "assistant");
    chatState.initialized = true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value || value.length < 3) return;

    input.value = "";
    await sendChatMessage(value, "general");
  });
}

function initIntentButtons() {
  const buttons = document.querySelectorAll("[data-chat-intent]");
  const input = document.getElementById("chatInput");

  buttons.forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const intent = button.getAttribute("data-chat-intent") || "general";
      const message = CHAT_CONFIG.intents[intent] || CHAT_CONFIG.intents.general;
      const sourceLabel = resolveSourceContext(button);

      openChatModal(sourceLabel);
      appendContextGreeting(intent, sourceLabel);

      if (input) input.value = "";
      await sendChatMessage(message, intent);
    });
  });
}

function initChatAutoOpenTriggers() {
  const { autoOpen } = CHAT_UI_CONFIG;
  if (!autoOpen.enabled) return;

  getAutoOpenCount();

  if (autoOpen.delayMs > 0) {
    window.setTimeout(() => {
      openByTrigger("tiempo");
    }, autoOpen.delayMs);
  }

  if (autoOpen.scrollPercent > 0) {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const progress = (window.scrollY / scrollable) * 100;
      if (progress >= autoOpen.scrollPercent) {
        openByTrigger("scroll");
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
  }

  if (autoOpen.exitIntent) {
    let handled = false;
    document.addEventListener("mouseout", (event) => {
      if (handled) return;
      if (window.innerWidth < 900) return;
      if (!event.relatedTarget && event.clientY <= 12) {
        handled = true;
        openByTrigger("salida");
      }
    });
  }
}

initSmoothScroll();
initChatWidget();
initChatForm();
initIntentButtons();
initChatAutoOpenTriggers();

/* GENERADO por scripts/bundle-api.ts — no editar a mano. */

// src/servidor/origen.ts
var ORIGENES_PERMITIDOS = [
  "https://maracacao.mx",
  "https://www.maracacao.mx",
  "http://localhost:4321",
  "http://localhost:4322"
];
var PREVIEW_DE_VERCEL = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;
function origenPermitido(origen) {
  return ORIGENES_PERMITIDOS.includes(origen) || PREVIEW_DE_VERCEL.test(origen);
}

// src/servidor/entradas/contacto.ts
var esTexto = (v) => typeof v === "string";
async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Solo POST" });
  }
  const clave = process.env.RESEND_API_KEY;
  if (!clave) {
    return res.status(503).json({ error: "Env\xEDo no configurado" });
  }
  const origen = String(req.headers.origin ?? "");
  if (!origenPermitido(origen)) return res.status(403).json({ error: "Origen no permitido" });
  const b = req.body ?? {};
  const nombre = esTexto(b.nombre) ? b.nombre.trim().slice(0, 120) : "";
  const correo = esTexto(b.correo) ? b.correo.trim().slice(0, 200) : "";
  const tipo = b.tipo === "negocio" ? "negocio" : "personal";
  const mensaje = esTexto(b.mensaje) ? b.mensaje.trim().slice(0, 4e3) : "";
  if (esTexto(b.apellido) && b.apellido.length > 0) {
    return res.status(200).json({ ok: true });
  }
  const inicio = Number(b.inicio);
  if (!Number.isFinite(inicio) || Date.now() - inicio < 4e3) {
    return res.status(200).json({ ok: true });
  }
  if (!nombre || !mensaje || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: "Faltan datos o el correo no es v\xE1lido" });
  }
  const secretoTurnstile = process.env.TURNSTILE_SECRET;
  if (secretoTurnstile) {
    const token = esTexto(b.turnstile) ? b.turnstile : "";
    const verificacion = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretoTurnstile, response: token })
    }).then((r) => r.json());
    if (!verificacion.success) {
      return res.status(403).json({ error: "Verificaci\xF3n anti-bots fallida" });
    }
  }
  const destino = process.env.CONTACTO_DESTINO ?? "maracacaomx@gmail.com";
  const remitente = process.env.CONTACTO_REMITENTE ?? "Maracacao <onboarding@resend.dev>";
  const asunto = `Mensaje del sitio \u2014 ${tipo === "negocio" ? "negocio" : "compra personal"} \u2014 ${nombre}`;
  const envio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: remitente,
      to: [destino],
      reply_to: correo,
      subject: asunto,
      text: [
        `Nombre: ${nombre}`,
        `Correo: ${correo}`,
        `Tipo: ${tipo === "negocio" ? "Para su negocio (cafeter\xEDa, panader\xEDa, reposter\xEDa)" : "Compra personal"}`,
        "",
        mensaje,
        "",
        "\u2014",
        "Enviado desde el formulario de maracacao.mx"
      ].join("\n")
    })
  });
  if (!envio.ok) {
    return res.status(502).json({ error: "El servicio de correo no acept\xF3 el env\xEDo" });
  }
  return res.status(200).json({ ok: true });
}
export {
  handler as default
};

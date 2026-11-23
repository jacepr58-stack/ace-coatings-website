// Cloudflare Worker for acecoatingsutah.com.
// - Static files (the site) are served from ./public by Cloudflare automatically.
// - POST /api/lead receives the 3-question estimate form and forwards it to the CRM.
//
// The CRM address is NOT stored in this repo. Set it in Cloudflare:
//   Workers & Pages > ace-coatings-website > Settings > Variables and Secrets
//   name: LEAD_WEBHOOK_URL   type: Secret
// Today that is a GoHighLevel workflow "Inbound Webhook" URL.
// When the business moves to ForgeIQ, swap that value (and the payload field
// names below, if ForgeIQ needs different ones). Nothing else changes.

const MAX_LEN = 500;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/design") {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
      return handleDesign(request, env);
    }
    if (url.pathname === "/api/lead") {
      if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
      return handleLead(request, env);
    }
    // Everything else: the static site.
    return env.ASSETS.fetch(request);
  },
};

function clean(v) {
  return typeof v === "string" ? v.trim().slice(0, MAX_LEN) : "";
}

async function handleLead(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const lead = {
    name: clean(body.name),
    phone: clean(body.phone),
    service: clean(body.service),
    location: clean(body.location),
    design: clean(body.design),
    addons: clean(body.addons),
    page: clean(body.page),
    submitted_at: clean(body.submitted_at) || new Date().toISOString(),
    source: "acecoatingsutah.com estimate form",
  };

  const digits = lead.phone.replace(/\D/g, "");
  if (!lead.name || digits.length < 10 || !lead.service || lead.location.length < 2) {
    return json({ ok: false, error: "missing_fields" }, 422);
  }

  // Split name for CRMs that want first/last.
  const [first_name, ...rest] = lead.name.split(/\s+/);
  const payload = { ...lead, first_name, last_name: rest.join(" ") };

  if (!env.LEAD_WEBHOOK_URL) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const res = await fetch(env.LEAD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return json({ ok: false, error: "crm_rejected", status: res.status }, 502);
  }
  return json({ ok: true });
}

// ---------------------------------------------------------------- court designer
// POST /api/design: { name, email, phone, summary, link, png (data URL), page }
// 1. Sends the lead to the same CRM webhook as the estimate form (LEAD_WEBHOOK_URL).
// 2. If RESEND_API_KEY is set, emails the design picture to the customer and to
//    DESIGN_NOTIFY_TO (default info@acecoatingsutah.com) from EMAIL_FROM.
//    Set those in Cloudflare > Workers > ace-coatings-website > Settings > Variables and Secrets.
const MAX_PNG = 6_000_000; // characters of base64
async function handleDesign(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  if (typeof b.company === "string" && b.company.trim()) return json({ ok: true, emailed: false }); // bot honeypot
  const name = clean(b.name).slice(0, 80);
  const email = clean(b.email).slice(0, 120);
  const phone = clean(b.phone).slice(0, 20);
  const summary = typeof b.summary === "string" ? b.summary.trim().slice(0, 3000) : "";
  const link = typeof b.link === "string" && /^https:\/\/(www\.)?(acecoatingsutah\.com|ace-coatings-website\.jacepr58\.workers\.dev)\/designer(-preview)?#d=[\w-]+$/.test(b.link) && b.link.length < 8000 ? b.link : "";
  const png = typeof b.png === "string" && b.png.startsWith("data:image/png;base64,") && b.png.length < MAX_PNG ? b.png.slice(22) : "";
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 10) {
    return json({ ok: false, error: "missing_fields" }, 422);
  }
  if (!env.LEAD_WEBHOOK_URL) return json({ ok: false, error: "not_configured" }, 503);

  const [first_name, ...rest] = name.split(/\s+/);
  const lead = {
    name, first_name, last_name: rest.join(" "), phone, email,
    service: "Court designer", location: "", design: summary, design_link: link,
    page: clean(b.page), submitted_at: clean(b.submitted_at) || new Date().toISOString(),
    source: "acecoatingsutah.com court designer",
  };
  const res = await fetch(env.LEAD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
  if (!res.ok) return json({ ok: false, error: "crm_rejected", status: res.status }, 502);

  let emailed = false;
  if (env.RESEND_API_KEY && png) {
    const from = env.EMAIL_FROM || "Ace Coatings <designs@acecoatingsutah.com>";
    const team = env.DESIGN_NOTIFY_TO || "info@acecoatingsutah.com";
    const att = [{ filename: "ace-coatings-court-design.png", content: png, content_id: "court-design" }];
    const lines = esc(summary).replace(/\n/g, "<br>");
    const customer = `<div style="font-family:Arial,sans-serif;color:#12243F;max-width:640px">
      <h2 style="margin:0 0 8px">Here's your court design, ${esc(first_name)}!</h2>
      <p>Thanks for designing your court with Ace Coatings. Your design is below and attached. We'll reach out soon with a quote.</p>
      <img src="cid:court-design" alt="Your court design" style="width:100%;border-radius:10px">
      <p style="font-size:14px;line-height:1.5">${lines}</p>
      ${link ? `<p><a href="${link}" style="color:#387FE5;font-weight:bold">Open your design again</a></p>` : ""}
      <p>Questions? Call or text 385-269-0060 or reply to this email.</p>
      <p style="color:#56657A;font-size:12px">Ace Coatings &middot; acecoatingsutah.com</p></div>`;
    const internal = `<div style="font-family:Arial,sans-serif;color:#12243F">
      <h2 style="margin:0 0 8px">New court designer lead</h2>
      <p><b>${esc(name)}</b><br>${esc(phone)}<br>${esc(email)}</p>
      <p style="font-size:14px;line-height:1.5">${lines}</p>
      ${link ? `<p><a href="${link}">Open the design</a></p>` : ""}
      <img src="cid:court-design" alt="Court design" style="width:100%;max-width:900px"></div>`;
    const send = (to, subject, html, reply_to) => fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, reply_to, attachments: att }),
    }).then(r => r.ok).catch(() => false);
    const [a] = await Promise.all([
      send(email, "Your Ace Coatings court design", customer, team),
      send(team, `New court design: ${name}`, internal, email),
    ]);
    emailed = a;
  }
  return json({ ok: true, emailed });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

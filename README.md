# Ace Coatings Utah website

The public site for acecoatingsutah.com. Plain HTML, CSS and JavaScript, no build step.
Hosted on Cloudflare Workers (static assets): every push to `main` deploys automatically.

## Files

- `public/index.html`: the whole homepage (squeegee hero, paint pour, court designer, court layers, build steps, gallery, reviews, estimate form).
- `public/img/`: photos and logos, already resized for the web.
- `public/_redirects`: sends old page addresses from the previous site to the right section.
- `src/worker.js`: handles `POST /api/lead` (the estimate form) and forwards it to the CRM. Every other path is served from `public/`.
- `wrangler.jsonc`: Cloudflare config.

## Cloudflare setup (one time)

1. Cloudflare dashboard > Workers & Pages > Create > Import a repository > `ace-coatings-website`.
2. Project name `ace-coatings-website`, Build command empty, Deploy command `npx wrangler deploy`. Deploy.
3. You get a test address ending in `.workers.dev`.
4. Settings > Variables and Secrets: add `LEAD_WEBHOOK_URL` (type Secret) with the CRM webhook URL.

Until `LEAD_WEBHOOK_URL` is set, the form shows a "call or text us" message instead of sending.

## Leads

Today leads go to a GoHighLevel workflow with an Inbound Webhook trigger.
After the move to ForgeIQ, change `LEAD_WEBHOOK_URL` (and the field names in `src/worker.js` if ForgeIQ needs different ones).

Fields sent: `name`, `first_name`, `last_name`, `phone`, `service`, `location`, `design` (court colors and any add-ons), `addons`, `page`, `submitted_at`, `source`.

## Local preview

`npx wrangler dev`, then open http://localhost:8787

## Going live on acecoatingsutah.com (when approved)

- Add the custom domain in the Worker's Settings > Domains & Routes, then update DNS at GoDaddy as Cloudflare instructs. Keep the existing MX/email records so info@ email keeps working.
- Add GA4, Google Ads and Meta pixel tags to `public/index.html`.
- Add the blog and privacy policy pages, and their redirects.

## Copy rule

Never put the word "sport" directly before "court" or "courts" anywhere on the site: that phrase is a trademark. Use "multi-use court" or just "court".

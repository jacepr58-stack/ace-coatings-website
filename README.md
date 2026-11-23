# Ace Coatings Utah website

The public site for acecoatingsutah.com. Plain HTML, CSS and JavaScript, no build step.
Hosted on Cloudflare Pages: every push to `main` publishes automatically.

## Files

- `index.html`: the whole homepage (squeegee hero, paint pour, court designer, court layers, build steps, gallery, reviews, estimate form).
- `img/`: photos and logos, already resized for the web.
- `functions/api/lead.js`: receives the estimate form and forwards it to the CRM.
- `_redirects`: sends old page addresses from the previous site to the right section.

## Cloudflare Pages setup (one time)

1. Cloudflare dashboard > Workers & Pages > Create > Pages > Connect to Git.
2. Pick `ace-coatings-website`. Framework preset: **None**. Build command: leave empty. Build output directory: `/`.
3. Save and deploy. You get a test address ending in `.pages.dev`.
4. Settings > Variables and secrets: add `LEAD_WEBHOOK_URL` (type Secret) with the CRM webhook URL, then redeploy.

Until `LEAD_WEBHOOK_URL` is set, the form shows a "call or text us" message instead of sending.

## Leads

Today leads go to a GoHighLevel workflow with an Inbound Webhook trigger.
After the move to ForgeIQ, change `LEAD_WEBHOOK_URL` (and the field names in `functions/api/lead.js` if ForgeIQ needs different ones).

Fields sent: `name`, `first_name`, `last_name`, `phone`, `service`, `location`, `design`, `page`, `submitted_at`, `source`.

## Going live on acecoatingsutah.com (when approved)

- Add the custom domain in the Pages project, then update DNS at GoDaddy as Cloudflare instructs. Keep the existing MX/email records so info@ email keeps working.
- Add GA4, Google Ads and Meta pixel tags to `index.html`.
- Add the blog and privacy policy pages, and their redirects.

## Copy rule

Never put the word "sport" directly before "court" or "courts" anywhere on the site: that phrase is a trademark. Use "multi-use court" or just "court".

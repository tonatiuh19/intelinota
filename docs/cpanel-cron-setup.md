> **Note:** Vercel Cron (configured in `vercel.json`) now runs this every 5 minutes automatically. The cPanel cron is only needed as a fallback. The `?secret=` query parameter is no longer accepted.

# cPanel cron — scheduled publishing

> Full guide: [SCHEDULED_PUBLISH_CRON_SETUP.md](./SCHEDULED_PUBLISH_CRON_SETUP.md)

## 1. Set `CRON_SECRET`

Vercel → **Settings → Environment Variables** (Production) and `.env`:

```
CRON_SECRET=replace_with_a_long_random_string
```

```bash
openssl rand -hex 32
```

Redeploy after changes.

## 2. Add cron in cPanel

**Advanced → Cron Jobs** — every 5 minutes:

| Minute | Hour | Day | Month | Weekday |
| ------ | ---- | --- | ----- | ------- |
| `*/5`  | `*`  | `*` | `*`   | `*`     |

```bash
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "https://www.intelinota.com/api/cron/publish-scheduled" > /dev/null 2>&1
```

## 3. Test

```bash
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" "https://www.intelinota.com/api/cron/publish-scheduled"
```

Expected: `{ "success": true, "published": 0, "message": "0 article(s) published" }`

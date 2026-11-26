# Scheduled Publishing — Cron Setup

## Overview

When an editor **schedules** an article, it stays `status = 'scheduled'` until a cron job publishes it. Intelinota runs on **Vercel** (no background workers), so **HostGator cPanel** hits the API on a timer.

| Component | Trigger | Purpose |
| --------- | ------- | ------- |
| `GET /api/cron/publish-scheduled` | Every 5 min (cron) | Set `status = 'published'` when `published_at <= NOW()` |

Production domain: **https://www.intelinota.com**

---

## 1. Set environment variables

Add to **Vercel** (Production) and your local **`.env`**:

```
CRON_SECRET=replace_with_a_long_random_string
```

Generate a strong value:

```bash
openssl rand -hex 32
```

Redeploy Vercel after any change.

Auth options (all equivalent):

- `?secret=YOUR_CRON_SECRET` query param (**recommended for cPanel curl**)
- `Authorization: Bearer YOUR_CRON_SECRET`
- `x-cron-secret: YOUR_CRON_SECRET` header

---

## 2. Add cron jobs in cPanel

1. Log in to **cPanel** (HostGator → **My Account** → **cPanel**).
2. Go to **Advanced → Cron Jobs**.
3. Add the job below.

### 2a. Publish scheduled articles — every 5 minutes

| Field   | Value |
| ------- | ----- |
| Minute  | `*/5` |
| Hour    | `*`   |
| Day     | `*`   |
| Month   | `*`   |
| Weekday | `*`   |

```bash
curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=YOUR_CRON_SECRET" > /dev/null 2>&1
```

Replace `YOUR_CRON_SECRET` with the value from section 1.

> On some HostGator plans, use `/usr/bin/curl` instead of `curl` if you get “command not found”.

Expected response (without `> /dev/null`):

```json
{ "success": true, "published": 0, "message": "0 article(s) published" }
```

### 2b. Every minute (optional)

| Field   | Value |
| ------- | ----- |
| Minute  | `*`   |
| Hour    | `*`   |
| Day     | `*`   |
| Month   | `*`   |
| Weekday | `*`   |

Same command as 2a. Use **either** 2a or 2b, not both.

---

## 3. How it works

```
Admin saves article → status = 'scheduled', published_at = future (UTC)

Every 5 min — cPanel cron:
  curl ".../api/cron/publish-scheduled?secret=CRON_SECRET"

API updates rows where scheduled + published_at <= NOW()
  → status = 'published'
  → article visible on intelinota.com
```

---

## 4. Manually trigger a test run

```bash
curl -v "https://www.intelinota.com/api/cron/publish-scheduled?secret=YOUR_CRON_SECRET"
```

Or from the project root:

```bash
curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=$(grep '^CRON_SECRET=' .env | cut -d= -f2-)"
```

Expected when nothing is due:

```json
{ "success": true, "published": 0, "message": "0 article(s) published" }
```

---

## 5. Monitoring queries

```sql
-- Waiting to go live
SELECT id, slug, title, published_at
FROM articles
WHERE status = 'scheduled'
ORDER BY published_at ASC;

-- Overdue (cron should have published these)
SELECT id, slug, title, published_at
FROM articles
WHERE status = 'scheduled' AND published_at <= NOW();
```

---

## 6. Troubleshooting

| Problem | Fix |
| ------- | --- |
| `Unauthorized` | Same `CRON_SECRET` in Vercel, `.env`, and curl URL; redeploy Vercel |
| `CRON_SECRET not configured` | Add env var on Vercel Production and redeploy |
| `curl: command not found` | Use `/usr/bin/curl` in the cPanel command |
| Article still scheduled | Wait one cron interval; check overdue SQL above |

---

## 7. Summary

| Endpoint | Interval | Command |
| -------- | -------- | ------- |
| `/api/cron/publish-scheduled` | `*/5 * * * *` | `curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=YOUR_CRON_SECRET" > /dev/null 2>&1` |

# HostGator cPanel — Scheduled publish cron

> Full guide: [SCHEDULED_PUBLISH_CRON_SETUP.md](./SCHEDULED_PUBLISH_CRON_SETUP.md)

## cPanel → Advanced → Cron Jobs

**Every 5 minutes** (`*/5 * * * *`):

```bash
curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=YOUR_CRON_SECRET" > /dev/null 2>&1
```

Replace `YOUR_CRON_SECRET` with the value in Vercel and `.env`.

If HostGator reports `curl: command not found`:

```bash
/usr/bin/curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=YOUR_CRON_SECRET" > /dev/null 2>&1
```

**Test:**

```bash
curl -s "https://www.intelinota.com/api/cron/publish-scheduled?secret=YOUR_CRON_SECRET"
```

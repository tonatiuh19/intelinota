# Setting Up a Cron Job in cPanel — Scheduled Publishing

This cron job periodically checks for articles with `status = 'scheduled'` whose
publish date has arrived and publishes them automatically.

---

## Step 1 — Add CRON_SECRET in Vercel

1. Go to [vercel.com](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Create a new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** a random secure string, e.g. `mI9xK3pL7qRv2wNz`
   - **Environment:** Production (and Preview if needed)
3. Click **Redeploy** so the variable takes effect

---

## Step 2 — Configure the Cron Job in cPanel

1. Log in to cPanel and find **Cron Jobs** (under the "Advanced" section)
2. Under **Add New Cron Job**, set the frequency:

   | Field   | Value | Meaning         |
   | ------- | ----- | --------------- |
   | Minute  | `*/5` | every 5 minutes |
   | Hour    | `*`   | every hour      |
   | Day     | `*`   | every day       |
   | Month   | `*`   | every month     |
   | Weekday | `*`   | any day         |

   > For near-instant publishing, change Minute to `*` (every minute).

3. In the **Command** field, paste exactly this (replace the values inside `< >`):

```
curl -s -X POST "https://<your-project>.vercel.app/api/cron/publish-scheduled" -H "x-cron-secret: <YOUR_CRON_SECRET>" > /dev/null 2>&1
```

**Real example:**

```
curl -s -X POST "https://intelinota.vercel.app/api/cron/publish-scheduled" -H "x-cron-secret: mI9xK3pL7qRv2wNz" > /dev/null 2>&1
```

4. Click **Add New Cron Job**

---

## Step 3 — Verify It Works

You can test the endpoint manually from your terminal before setting it up in cPanel:

```bash
curl -s -X POST "https://intelinota.vercel.app/api/cron/publish-scheduled" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Expected response when everything is OK and no articles are pending:

```json
{ "success": true, "published": 0, "message": "0 article(s) published" }
```

Response when articles were published:

```json
{ "success": true, "published": 2, "message": "2 article(s) published" }
```

Response when the secret is wrong:

```json
{ "success": false, "message": "Unauthorized" }
```

---

## How to Schedule an Article

1. In the admin panel, open or create an article
2. In the **Publication** sidebar panel, select **"Schedule publication"**
3. Pick a future date and time
4. Save — the article will be stored with `status = scheduled`
5. When the date arrives, the cron job will publish it automatically

> **Note:** Only administrators can schedule articles.
> Regular authors can only save drafts; an admin must approve and publish their work.

---

## Troubleshooting

| Problem                      | Likely cause                   | Solution                                                                                         |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Unauthorized`               | Wrong secret or not redeployed | Make sure `CRON_SECRET` in Vercel matches the value in the curl command exactly                  |
| `CRON_SECRET not configured` | Variable not added in Vercel   | Add the variable and redeploy                                                                    |
| `Cron job failed`            | Database error                 | Check logs in Vercel → Functions tab                                                             |
| Article is not published     | Timezone mismatch              | The server uses UTC — make sure the date you pick in the editor is correct when converted to UTC |

### Timezone (important)

The `published_at` field is stored in **UTC**. The datetime picker in the editor uses
your browser's local time and converts it to UTC automatically — you don't need to do
anything extra. Just be aware that if your MySQL server is also set to UTC, everything
will align correctly.

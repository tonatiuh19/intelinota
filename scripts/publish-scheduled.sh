#!/bin/bash
# =============================================================================
# intelinota — Scheduled Article Publisher
# =============================================================================
# Place this script on your cPanel server and configure it as a cron job.
#
# SETUP
# -----
# 1. Upload this file to your cPanel home directory, e.g.:
#      ~/scripts/publish-scheduled.sh
#
# 2. Make it executable:
#      chmod +x ~/scripts/publish-scheduled.sh
#
# 3. Set your environment variables below (or export them before running):
#      INTELINOTA_URL   — your Vercel/production API base URL
#      CRON_SECRET      — must match the CRON_SECRET env var set in Vercel
#
# 4. In cPanel → Cron Jobs, add a new cron entry:
#      Every minute:  * * * * *  /bin/bash ~/scripts/publish-scheduled.sh
#      Every 5 min:   */5 * * * * /bin/bash ~/scripts/publish-scheduled.sh
#
# =============================================================================

INTELINOTA_URL="${INTELINOTA_URL:-https://your-project.vercel.app}"
CRON_SECRET="${CRON_SECRET:-change-me-in-env}"

ENDPOINT="${INTELINOTA_URL}/api/cron/publish-scheduled"

RESPONSE=$(curl -s -o /tmp/intelinota_cron_response.txt -w "%{http_code}" \
  -X POST "${ENDPOINT}" \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json")

if [ "$RESPONSE" = "200" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK — $(cat /tmp/intelinota_cron_response.txt)"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR ${RESPONSE} — $(cat /tmp/intelinota_cron_response.txt)" >&2
fi

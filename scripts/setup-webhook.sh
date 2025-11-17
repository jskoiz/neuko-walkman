#!/bin/bash

# Script to set up Telegram webhook for Vercel deployment
# Usage: ./scripts/setup-webhook.sh <your-vercel-url> [webhook-secret]

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <vercel-url> [webhook-secret]"
  echo "Example: $0 https://your-app.vercel.app your-secret-token"
  exit 1
fi

VERCEL_URL="$1"
WEBHOOK_SECRET="${2:-}"

# Load environment variables from .env if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN not set"
  echo "Please set it in your .env file or export it:"
  echo "export TELEGRAM_BOT_TOKEN=your-token-here"
  exit 1
fi

WEBHOOK_URL="${VERCEL_URL}/api/telegram-webhook"

echo "Setting webhook URL: $WEBHOOK_URL"
echo "Bot Token: ${TELEGRAM_BOT_TOKEN:0:10}..."

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "Setting webhook without secret token..."
  curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"${WEBHOOK_URL}\"}"
else
  echo "Setting webhook with secret token..."
  curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{
      \"url\": \"${WEBHOOK_URL}\",
      \"secret_token\": \"${WEBHOOK_SECRET}\"
    }"
fi

echo ""
echo "✅ Webhook set successfully!"
echo ""
echo "Verifying webhook..."
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null || curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"


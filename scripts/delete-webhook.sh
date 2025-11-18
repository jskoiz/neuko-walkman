#!/bin/bash

# Script to delete Telegram webhook (for local development)
# Usage: ./scripts/delete-webhook.sh

set -e

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

echo "Deleting webhook..."
echo "Bot Token: ${TELEGRAM_BOT_TOKEN:0:10}..."

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"

echo ""
echo "✅ Webhook deleted successfully!"
echo ""
echo "Verifying webhook deletion..."
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null || curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
echo ""
echo "💡 You can now run the bot locally with: npm run bot:local"




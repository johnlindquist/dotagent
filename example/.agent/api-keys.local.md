---
id: api-keys
priority: high
---

## API Key Management

Private rules for handling API keys:

1. Store API keys in environment variables only
2. Use the following naming convention:
   - Production: `PROD_API_KEY_SERVICENAME`
   - Development: `DEV_API_KEY_SERVICENAME`
3. Never commit .env files
4. Rotate keys every 90 days
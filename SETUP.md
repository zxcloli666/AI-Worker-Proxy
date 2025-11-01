# Quick Setup Guide

## Prerequisites

- Node.js 20+ installed
- Cloudflare account
- API keys for the AI providers you want to use

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Your Model Names

Edit `wrangler.toml` and customize the `ROUTES_CONFIG` section:

```toml
ROUTES_CONFIG = '''
{
  "your-model-name": [
    {
      "provider": "anthropic",
      "model": "claude-opus-4-20250514",
      "apiKeys": ["ANTHROPIC_KEY_1"]
    }
  ]
}
'''
```

**Note**: Use model names (e.g., `"fast"`, `"deep-think"`) in your API requests, not URL paths.

### 3. Set Up API Keys

For local development, create a `.dev.vars` file:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and add your API keys:

```
PROXY_AUTH_TOKEN=my-secret-token
ANTHROPIC_KEY_1=sk-ant-xxxxx
GOOGLE_KEY_1=AIzaxxxxx
OPENAI_KEY_1=sk-xxxxx
```

For production, use Wrangler secrets:

```bash
wrangler secret put PROXY_AUTH_TOKEN
wrangler secret put ANTHROPIC_KEY_1
wrangler secret put GOOGLE_KEY_1
# ... and so on
```

### 4. Test Locally

```bash
npm run dev
```

Test the endpoint:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-token" \
  -d '{
    "model": "your-model-name",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 5. Deploy to Cloudflare

```bash
npm run deploy
```

### 6. Set Up GitHub Actions (Optional)

For automatic deployment on push to main:

1. Go to your Cloudflare dashboard
2. Get your API token: https://dash.cloudflare.com/profile/api-tokens
3. Get your Account ID from the dashboard
4. Add these as GitHub secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

Now every push to `main` will automatically deploy!

## Common Issues

### "Unauthorized" error

- Check that your `Authorization` header matches `PROXY_AUTH_TOKEN`
- Format: `Authorization: Bearer your-token-here`

### "All providers failed"

- Verify API keys are set correctly
- Check the provider and model names in your config
- Look at the logs in Cloudflare dashboard

### Cloudflare AI not working

- Make sure you have the `[ai]` binding in `wrangler.toml`
- Cloudflare AI is only available on certain plans

### TypeScript errors

```bash
npm run type-check
```

### Linting errors

```bash
npm run lint
npm run format
```

## Next Steps

- Read the full [README.md](README.md)
- Check out [examples/](examples/) for client code
- Customize error handling in `src/utils/error-handler.ts`
- Add your own providers in `src/providers/`

## Support

Open an issue on GitHub if you need help!

# AI Worker Proxy

OpenAI-compatible proxy for multiple AI providers on Cloudflare Workers. Route requests to multiple AI services with automatic failover, token rotation, and streaming support.

## Features

- **OpenAI-Compatible API**: Drop-in replacement for OpenAI API clients
- **Multiple Providers**: Support for Anthropic Claude, Google Gemini, OpenAI, custom OpenAI-compatible APIs, and Cloudflare AI Workers
- **Model-Based Routing**: Use model names (e.g., `model: "deep-think"`) to route to different provider chains
- **Token Rotation**: Automatic rotation through multiple API keys with retry logic
- **Streaming Support**: Full SSE streaming support for all providers
- **Tools/Function Calling**: Pass-through support for tools and MCP
- **CORS Enabled**: Works from browsers with unrestricted CORS
- **Authentication**: Built-in proxy authentication
- **Auto-Deploy**: GitHub Actions integration for automatic deployment

## Supported Providers

| Provider | Type | Streaming | Tools | Notes |
|----------|------|-----------|-------|-------|
| Anthropic Claude | `anthropic` | ✅ | ✅ | Uses official SDK |
| Google Gemini | `google` | ✅ | ✅ | Uses official SDK |
| OpenAI | `openai` | ✅ | ✅ | Uses official SDK |
| Custom OpenAI-compatible | `openai-compatible` | ✅ | ✅ | NVIDIA AI, etc. |
| Cloudflare AI Workers | `cloudflare-ai` | ✅ | ❌ | Converts to OpenAI format |

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd AI-Worker-Proxy
npm install
```

### 2. Configure Model Routing

**For Production (Cloudflare Dashboard):**

1. Go to: `Cloudflare Dashboard` → `Workers & Pages` → `ai-worker-proxy` → `Settings` → `Variables`
2. Add Environment Variable `ROUTES_CONFIG`:
   ```json
   {
     "deep-think": [
       {
         "provider": "anthropic",
         "model": "claude-opus-4-20250514",
         "apiKeys": ["ANTHROPIC_KEY_1"]
       }
     ],
     "fast": [
       {
         "provider": "google",
         "model": "gemini-2.0-flash-exp",
         "apiKeys": ["GOOGLE_KEY_1"]
       }
     ]
   }
   ```
3. See `wrangler.toml` for more configuration examples

**For Local Development:**

Create `.dev.vars` file (see `.dev.vars.example` for format)

**Note**: Model names (e.g., `"deep-think"`, `"fast"`) are used in your API requests, not URL paths.

### 3. Set API Keys and Auth Token

**Via Cloudflare Dashboard (Recommended):**

1. Go to: `Workers & Pages` → `ai-worker-proxy` → `Settings` → `Variables`
2. Click "Add variable" → Select "Encrypt" for secrets:
   - `ANTHROPIC_KEY_1` = `sk-ant-xxxxx`
   - `GOOGLE_KEY_1` = `AIzaxxxxx`
   - `OPENAI_KEY_1` = `sk-xxxxx`
   - `PROXY_AUTH_TOKEN` = `your-secret-token`

**Or via Wrangler CLI:**

```bash
wrangler secret put ANTHROPIC_KEY_1
wrangler secret put GOOGLE_KEY_1
wrangler secret put PROXY_AUTH_TOKEN
```

### 4. Deploy

```bash
# Deploy to Cloudflare Workers
npm run deploy

# Or run locally for development
npm run dev
```

## Configuration

### ⚠️ Public Repository - Private Config

**IMPORTANT**: This is a public repository. **DO NOT** commit your private API keys or production configuration to `wrangler.toml`!

For production/private configuration:
- 📖 **See [PRIVATE_CONFIG.md](PRIVATE_CONFIG.md)** for detailed instructions
- 🔒 Set environment variables in **Cloudflare Dashboard** → Settings → Variables
- ✅ The `wrangler.toml` has `keep_vars = true` to prevent overwriting your Dashboard config
- 📋 Example configuration is in `wrangler.toml` [vars] section (for reference only)

### Model Routing Configuration

Each model name maps to an array of provider configurations. The proxy will try providers in order until one succeeds.

**Important**: Routing is now based on the `model` field in your API request, not the URL path.

```json
{
  "model-name": [
    {
      "provider": "provider-type",
      "model": "actual-model-id",
      "apiKeys": ["ENV_VAR_1", "ENV_VAR_2"],
      "baseUrl": "https://api.example.com/v1"  // Only for openai-compatible
    }
  ]
}
```

### Provider Types

#### Anthropic Claude

```json
{
  "provider": "anthropic",
  "model": "claude-opus-4-20250514",
  "apiKeys": ["ANTHROPIC_KEY_1"]
}
```

#### Google Gemini

```json
{
  "provider": "google",
  "model": "gemini-2.0-flash-thinking-exp-01-21",
  "apiKeys": ["GOOGLE_KEY_1"]
}
```

#### OpenAI

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "apiKeys": ["OPENAI_KEY_1"]
}
```

#### Custom OpenAI-Compatible (e.g., NVIDIA AI)

```json
{
  "provider": "openai-compatible",
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "model": "nvidia/llama-3.1-nemotron-70b-instruct",
  "apiKeys": ["NVIDIA_KEY_1", "NVIDIA_KEY_2"]
}
```

#### Cloudflare AI Workers

```json
{
  "provider": "cloudflare-ai",
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "apiKeys": []
}
```

**Note**: Cloudflare AI requires the AI binding in `wrangler.toml`:

```toml
[ai]
binding = "AI"
```

## Usage Examples

### cURL

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-proxy-token-here" \
  -d '{
    "model": "deep-think",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-worker.workers.dev/v1/chat/completions",
    api_key="your-secret-proxy-token-here"
)

response = client.chat.completions.create(
    model="deep-think",  # Model name determines routing
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### JavaScript

```javascript
const response = await fetch('https://your-worker.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret-proxy-token-here'
  },
  body: JSON.stringify({
    model: 'fast',  // Use different model names for different provider chains
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  console.log(chunk);
}
```

### Function Calling / Tools

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"}
                }
            }
        }
    }
]

response = client.chat.completions.create(
    model="deep-think",  # Works with any configured model
    messages=[{"role": "user", "content": "What's the weather in NYC?"}],
    tools=tools
)
```

## Failover Logic

The proxy implements automatic failover at two levels:

### 1. Token Rotation
For each provider, the proxy tries API keys in order:
- If a key hits rate limits (429), it tries the next key
- If a key fails with a server error (500+), it tries the next key
- If all keys fail, it moves to the next provider

### 2. Provider Fallback
If all tokens for a provider fail, it tries the next provider in the model configuration.

Example flow for `model: "deep-think"`:
1. Try Anthropic with `ANTHROPIC_KEY_1`
2. If failed, try `ANTHROPIC_KEY_2`
3. If all Anthropic keys failed, try Google with `GOOGLE_KEY_1`
4. If all providers failed, return 500 error

## GitHub Actions Auto-Deploy

The repository includes automated deployment via GitHub Actions.

### Setup

1. Get your Cloudflare credentials:
   - API Token: https://dash.cloudflare.com/profile/api-tokens
   - Account ID: https://dash.cloudflare.com/ (right sidebar)

2. Add secrets to your GitHub repository:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

3. Push to `main` branch to trigger automatic deployment

### Workflows

- **`deploy.yml`**: Runs linting, type checking, and deploys to Cloudflare on push to `main`
- **`lint.yml`**: Runs linting and type checking on all branches and PRs

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Format code
npm run format
```

### Project Structure

```
AI-Worker-Proxy/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── types.ts              # TypeScript types
│   ├── router.ts             # Route configuration and provider fallback
│   ├── token-manager.ts      # Token rotation logic
│   ├── providers/
│   │   ├── base.ts           # Base provider interface
│   │   ├── anthropic.ts      # Anthropic Claude provider
│   │   ├── google.ts         # Google Gemini provider
│   │   ├── openai.ts         # OpenAI provider
│   │   ├── cloudflare-ai.ts  # Cloudflare AI provider
│   │   └── index.ts          # Provider factory
│   └── utils/
│       ├── error-handler.ts  # Error handling utilities
│       └── response-mapper.ts # OpenAI response formatting
├── .github/
│   └── workflows/
│       ├── deploy.yml        # Auto-deploy workflow
│       └── lint.yml          # Linting workflow
├── wrangler.toml             # Cloudflare Workers configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Authentication

The proxy requires authentication via the `Authorization` header:

```bash
Authorization: Bearer your-secret-proxy-token-here
# or just
Authorization: your-secret-proxy-token-here
```

Set your token in `wrangler.toml` or via secret:

```bash
wrangler secret put PROXY_AUTH_TOKEN
```

Health check endpoint (`/health`) does not require authentication.

## CORS

CORS is enabled for all origins (`Access-Control-Allow-Origin: *`). The proxy works seamlessly from browsers and web applications.

## Error Handling

The proxy returns OpenAI-compatible error responses:

```json
{
  "error": {
    "message": "All providers failed",
    "type": "proxy_error",
    "code": "provider_failure"
  }
}
```

Common error codes:
- `401`: Unauthorized (invalid proxy token)
- `404`: Model configuration not found
- `429`: Rate limit exceeded (all tokens exhausted)
- `500`: All providers failed

## Monitoring

Logs are available in Cloudflare Workers dashboard:
- Request logs
- Provider failover events
- Token rotation attempts
- Error details

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and type checking
5. Submit a pull request

## Roadmap

- [ ] Request/response caching
- [ ] Rate limiting per user/token
- [ ] Analytics and usage metrics
- [ ] Load balancing strategies (round-robin, least-loaded)
- [ ] Retry with exponential backoff
- [ ] Custom model mappings
- [ ] Response transformation hooks

## Support

For issues, questions, or contributions, please open an issue on GitHub.

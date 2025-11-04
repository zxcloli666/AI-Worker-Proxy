# 🚀 AI Worker Proxy - OpenAI API Gateway for Multiple AI Providers

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-green)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Free OpenAI API proxy** with automatic failover, token rotation, and multi-provider support. Deploy your own **AI gateway** on Cloudflare Workers in minutes - no server costs, unlimited scalability.

**Universal AI API proxy** that converts Anthropic Claude, Google Gemini, Cloudflare AI, and other providers into OpenAI-compatible endpoints. Perfect for developers who want **one API for all AI models** with built-in failover and load balancing.

---

## ⚡ Key Features - Why Choose This Proxy?

### 🔄 Multi-Provider AI Gateway
- **Anthropic Claude** (Claude Opus, Sonnet, Haiku) - streaming + tools
- **Google Gemini** (Gemini Pro, Flash, Thinking models) - full support
- **OpenAI** (GPT-4, GPT-4o, o1, o3) - native compatibility
- **Cloudflare AI Workers** - free tier models
- **Custom OpenAI APIs** (NVIDIA NIM, Azure, OpenRouter, etc.)

### 🎯 Smart Routing & Reliability
- ✅ **Automatic Failover** - switches providers when one fails
- 🔑 **Token Rotation** - cycles through multiple API keys
- 📊 **Model-Based Routing** - use model names to route requests
- 🌊 **Streaming Support** - real-time SSE responses
- 🛠️ **Function Calling** - tools & MCP support
- 🔒 **Built-in Auth** - secure your proxy with tokens

### 💰 Cost-Effective & Easy
- 💲 **Free Hosting** on Cloudflare Workers (100k requests/day)
- ⚡ **Zero Latency** - edge deployment worldwide
- 🔧 **One-Click Deploy** via GitHub Actions
- 🌐 **CORS Enabled** - works directly from browsers
- 📝 **Drop-in Replacement** for OpenAI SDK

---

## 🎮 Quick Start - 3 Steps to Deploy

### Step 1️⃣: Clone & Install

```bash
git clone https://github.com/zxcnoname666/AI-Worker-Proxy.git
cd AI-Worker-Proxy
npm install
```

### Step 2️⃣: Configure Secrets in Cloudflare

Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers → Settings → Variables:

```
PROXY_AUTH_TOKEN = your-secret-token-123
ANTHROPIC_KEY_1 = sk-ant-xxxxx
GOOGLE_KEY_1 = AIzaxxxxx
OPENAI_KEY_1 = sk-xxxxx
```

### Step 3️⃣: Deploy Automatically

Add GitHub Secrets and push to `main`:

```bash
git push origin main
```

✅ **Done!** Your proxy is live at `https://your-worker.workers.dev`

📖 **Detailed Setup Guide**: See [Installation & Configuration](#-installation--configuration) below

---

## 💡 Use Cases - What Can You Build?

- 🤖 **AI Chatbots** with automatic provider fallback
- 📝 **Content Generation** tools with cost optimization
- 🔍 **AI Search** using multiple models simultaneously
- 🎨 **Creative Apps** with model mixing (Claude + GPT-4)
- 📊 **Analytics Tools** comparing AI model outputs
- 🌐 **Browser Extensions** with CORS-enabled AI access
- 📱 **Mobile Apps** using OpenAI SDK → your proxy URL

---

## 🔥 Supported AI Providers & Models

| Provider | Model Examples | Streaming | Function Calling | Notes |
|----------|---------------|-----------|------------------|-------|
| **Anthropic** | `claude-opus-4`, `claude-sonnet-4.5` | ✅ | ✅ | Official SDK |
| **Google** | `gemini-2.0-flash`, `gemini-thinking` | ✅ | ✅ | Gemini API |
| **OpenAI** | `gpt-4o`, `o1`, `o3-mini` | ✅ | ✅ | Native support |
| **Cloudflare AI** | `@cf/meta/llama-3.1-8b` | ✅ | ✅ | Free tier |
| **OpenAI-Compatible** | NVIDIA NIM, Azure, OpenRouter | ✅ | ✅ | Custom base URL |

---

## 📦 Installation & Configuration

### Prerequisites
- Node.js 18+ 
- Cloudflare Workers account (free tier works)
- API keys for desired providers

### Local Development

```bash
# Install dependencies
npm install

# Create .dev.vars file
cp .dev.vars.example .dev.vars

# Add your keys to .dev.vars
PROXY_AUTH_TOKEN=test-token
ANTHROPIC_KEY_1=sk-ant-xxxxx

# Start dev server
npm run dev
```

### Production Deploy

#### Option A: GitHub Actions (Recommended)

1. **Add Cloudflare Credentials** (GitHub Settings → Secrets):
   - `CLOUDFLARE_API_TOKEN` - [Get from here](https://dash.cloudflare.com/profile/api-tokens)
   - `CLOUDFLARE_ACCOUNT_ID` - [Find on dashboard](https://dash.cloudflare.com/)

2. **Add Route Configuration** (GitHub Settings → Variables):
   - Variable name: `ROUTES_CONFIG`
   - Value:
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

3. **Add API Keys** (Cloudflare Dashboard → Variables):
   - `PROXY_AUTH_TOKEN`
   - `ANTHROPIC_KEY_1`
   - `GOOGLE_KEY_1`
   - etc.

4. **Push to deploy**:
   ```bash
   git push origin main
   ```

#### Option B: Manual Deploy

```bash
npm run deploy
```

---

## 🎯 Usage Examples

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-worker.workers.dev/v1",
    api_key="your-secret-proxy-token"
)

# Use Claude via "deep-think" model name
response = client.chat.completions.create(
    model="deep-think",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### JavaScript/TypeScript

```javascript
const response = await fetch('https://your-worker.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret-proxy-token'
  },
  body: JSON.stringify({
    model: 'fast',  // Routes to Google Gemini
    messages: [
      { role: 'user', content: 'Write a haiku about AI' }
    ],
    stream: false
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### cURL

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-proxy-token" \
  -d '{
    "model": "deep-think",
    "messages": [{"role": "user", "content": "Hello AI!"}]
  }'
```

### Function Calling / Tools

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "City name"}
                },
                "required": ["location"]
            }
        }
    }
]

response = client.chat.completions.create(
    model="deep-think",
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
    tools=tools
)
```

---

## ⚙️ Advanced Configuration

### Route Configuration Format

Routes map model names to provider chains with automatic failover:

```json
{
  "model-name": [
    {
      "provider": "anthropic",
      "model": "claude-opus-4-20250514",
      "apiKeys": ["ANTHROPIC_KEY_1", "ANTHROPIC_KEY_2"]
    },
    {
      "provider": "google",
      "model": "gemini-2.0-flash-exp",
      "apiKeys": ["GOOGLE_KEY_1"]
    }
  ]
}
```

**Failover Logic**:
1. Try `ANTHROPIC_KEY_1` → if fails, try `ANTHROPIC_KEY_2`
2. If all Anthropic keys fail → try Google provider
3. If all providers fail → return 500 error

### Provider-Specific Configuration

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

#### Custom OpenAI-Compatible API (NVIDIA, Azure, etc.)
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

> **Note**: Cloudflare AI requires the AI binding in `wrangler.toml`:
> ```toml
> [ai]
> binding = "AI"
> ```

---

## 🔒 Security Best Practices

### Authentication
The proxy requires authentication via `Authorization` header:

```bash
Authorization: Bearer your-secret-proxy-token
# or
Authorization: your-secret-proxy-token
```

Set your token in Cloudflare Dashboard (Workers → Settings → Variables):
```
PROXY_AUTH_TOKEN = your-random-secret-123
```

### Secrets Management

⚠️ **CRITICAL**: This is a public repository

- ❌ **NEVER** commit API keys to git
- ✅ Store secrets in **Cloudflare Dashboard** (persist forever)
- ✅ Store `ROUTES_CONFIG` in **GitHub Variables** (replaced during deploy)
- ✅ Use `.dev.vars` for local development (add to `.gitignore`)

📖 See [PRIVATE_CONFIG.md](PRIVATE_CONFIG.md) for detailed security guide

---

## 🛠️ Development

### Project Structure

```
AI-Worker-Proxy/
├── src/
│   ├── index.ts              # Main worker entry
│   ├── types.ts              # TypeScript types
│   ├── router.ts             # Route configuration & failover
│   ├── token-manager.ts      # Token rotation logic
│   ├── providers/
│   │   ├── base.ts           # Base provider interface
│   │   ├── anthropic.ts      # Claude provider
│   │   ├── google.ts         # Gemini provider
│   │   ├── openai.ts         # OpenAI provider
│   │   └── cloudflare-ai.ts  # Cloudflare AI provider
│   └── utils/
│       ├── error-handler.ts  # Error handling
│       └── response-mapper.ts # OpenAI format conversion
├── .github/workflows/
│   ├── deploy.yml            # Auto-deploy workflow
│   └── lint.yml              # Code quality checks
├── wrangler.toml             # Cloudflare config
└── README.md
```

### Available Commands

```bash
npm install        # Install dependencies
npm run dev        # Start local dev server
npm run deploy     # Deploy to Cloudflare
npm run type-check # TypeScript validation
npm run lint       # ESLint
npm run format     # Prettier
```

### GitHub Actions Workflows

- **deploy.yml**: Auto-deploys to Cloudflare on push to `main`
- **lint.yml**: Runs linting and type checking on all branches/PRs

---

## 🌐 API Reference

### Base URL
```
https://your-worker.workers.dev/v1
```

### Endpoints

#### POST `/v1/chat/completions`
OpenAI-compatible chat completions endpoint.

**Request**:
```json
{
  "model": "deep-think",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response**:
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "model": "deep-think",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }]
}
```

#### GET `/health`
Health check endpoint (no authentication required).

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 🐛 Error Handling

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

### Common Error Codes
- `401` - Unauthorized (invalid proxy token)
- `404` - Model configuration not found
- `429` - Rate limit exceeded (all API keys exhausted)
- `500` - All providers failed
- `502` - Provider unreachable

---

## 📊 Monitoring & Logs

### Cloudflare Dashboard
View logs at [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers → Logs:

- Request/response logs
- Provider failover events
- Token rotation attempts
- Error traces with stack traces

### Log Examples

```
✅ Request: model=deep-think provider=anthropic key=KEY_1
⚠️  Failover: anthropic/KEY_1 → anthropic/KEY_2 (rate limit)
❌ Provider failed: anthropic → trying google
✅ Success: google/KEY_1 responded in 1.2s
```

---

## 🚀 Roadmap & Future Features

- [ ] Request/response caching layer
- [ ] Per-user rate limiting
- [ ] Analytics dashboard (usage, costs, latency)
- [ ] Load balancing strategies (round-robin, least-loaded)
- [ ] Retry with exponential backoff
- [ ] Custom model name mappings
- [ ] Response transformation webhooks
- [ ] Multi-region deployment
- [ ] Cost tracking per API key
- [ ] Admin dashboard

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests: `npm run lint && npm run type-check`
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🔗 Useful Links

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Google Gemini API](https://ai.google.dev/docs)

---

## 💬 Support & Questions

- 🐛 **Issues**: [GitHub Issues](https://github.com/zxcnoname666/AI-Worker-Proxy/issues)
- 💡 **Discussions**: [GitHub Discussions](https://github.com/zxcnoname666/AI-Worker-Proxy/discussions)
- 📧 **Email**: Create an issue instead for faster response

---

## 🌟 Star History

If this project helped you, please give it a ⭐️!

<p align="center">
 <a href="https://github.com/zxcnoname666/AI-Worker-Proxy">
  <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zxcnoname666/AI-Worker-Proxy&type=date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zxcnoname666/AI-Worker-Proxy&type=date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=zxcnoname666/AI-Worker-Proxy&type=date" />
  </picture>
 </a>
</p>

<p align="center">
   <img src="https://count.getloli.com/get/@ai-worker-proxy">
</p>

---

## 📌 Keywords for Search

`openai proxy`, `ai gateway`, `api proxy`, `cloudflare workers ai`, `anthropic proxy`, `claude proxy`, `gemini proxy`, `multi provider ai`, `ai load balancer`, `openai compatible api`, `ai failover`, `free ai proxy`, `serverless ai`, `ai token rotation`, `ai api gateway`, `llm proxy`, `gpt proxy`, `free openai alternative`

---

**Made with ❤️ for the AI community**

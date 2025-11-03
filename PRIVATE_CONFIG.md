# Private Configuration for Production

## ⚠️ IMPORTANT: Public Repository

Since this is a public repository, **DO NOT add private tokens to `wrangler.toml`**!

## 🔒 How to Configure Private Config

### Method 1: Via Cloudflare Dashboard (RECOMMENDED)

1. **Open Cloudflare Dashboard:**
   - Navigate to: `Workers & Pages` → `ai-worker-proxy` → `Settings` → `Variables`

2. **Add Environment Variables:**

   **Variable: `ROUTES_CONFIG`**
   ```json
   {
     "your-model": [
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

   **Variable: `PROXY_AUTH_TOKEN`**
   ```
   your-real-secret-token
   ```

3. **Add Secrets (API keys):**
   - Click "Add variable" → select "Encrypt"
   - Add all your API keys:
     - `ANTHROPIC_KEY_1` = `sk-ant-xxxxx`
     - `GOOGLE_KEY_1` = `AIzaxxxxx`
     - `OPENAI_KEY_1` = `sk-xxxxx`
     - etc.

4. **Save and Deploy:**
   - Click "Save and Deploy"
   - Or just save - GitHub Actions won't overwrite these variables thanks to the `--keep-vars` flag

---

### Method 2: Via Wrangler CLI (locally)

```bash
# Add Environment Variables
wrangler secret put ANTHROPIC_KEY_1
wrangler secret put GOOGLE_KEY_1
wrangler secret put PROXY_AUTH_TOKEN

# Set ROUTES_CONFIG via dashboard or:
# Create a separate wrangler.production.toml (DO NOT commit!)
```

---

### Method 3: Cloudflare KV Storage (advanced)

If you want to modify config without redeploying:

1. **Create KV namespace:**
   ```bash
   wrangler kv:namespace create "CONFIG"
   ```

2. **Add to wrangler.toml:**
   ```toml
   [[kv_namespaces]]
   binding = "CONFIG"
   id = "your-kv-id"
   ```

3. **Upload config to KV:**
   ```bash
   wrangler kv:key put --namespace-id=xxx "ROUTES_CONFIG" @config.json
   ```

4. **Modify code to read from KV:**
   ```typescript
   // src/router.ts
   const configStr = await env.CONFIG.get("ROUTES_CONFIG") || env.ROUTES_CONFIG;
   ```

---

## 🚀 GitHub Actions and Private Config

GitHub Actions **WILL NOT overwrite** your private config because `wrangler.toml` has **NO [vars] section**:

```toml
# wrangler.toml
name = "ai-worker-proxy"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[ai]
binding = "AI"

# No [vars] section - all configuration via Dashboard or .dev.vars
```

This ensures your Cloudflare Dashboard variables are **never** overwritten during deployment.

### What happens during deployment:

- ✅ **Updated:** Code (TypeScript files)
- ✅ **Updated:** Dependencies (package.json)
- ❌ **NOT updated:** Environment Variables from dashboard
- ❌ **NOT updated:** Secrets

---

## 📋 Setup Checklist

- [ ] All Environment Variables added to Cloudflare Dashboard
- [ ] All Secrets (API keys) added
- [ ] Verified that `ROUTES_CONFIG` contains your private routes
- [ ] `wrangler.toml` in repo contains example only
- [ ] GitHub Actions has `--keep-vars` flag
- [ ] Tested deployment - private config is not overwritten

---

## 🔍 Configuration Verification

After deployment, verify that your private config is being used:

```bash
# Check variables
wrangler tail

# Or make a test request
curl https://your-worker.workers.dev/health
```

---

## ⚙️ Local Development

For local development, create `.dev.vars` (not committed):

```bash
# .dev.vars
PROXY_AUTH_TOKEN=local-dev-token
ANTHROPIC_KEY_1=sk-ant-xxxxx
GOOGLE_KEY_1=AIzaxxxxx

ROUTES_CONFIG={"test": [{"provider": "anthropic", "model": "claude-opus-4", "apiKeys": ["ANTHROPIC_KEY_1"]}]}
```

Then:
```bash
npm run dev
```

---

## 🆘 Troubleshooting

### Config gets overwritten on deploy

**Problem:** GitHub Actions overwrites your private config

**Solution:**
1. Make sure `wrangler.toml` has **NO [vars] section**
2. All configuration should be in Cloudflare Dashboard only
3. For local dev, use `.dev.vars` file (not committed)

### Variables are not being read

**Problem:** Worker doesn't see variables from dashboard

**Solution:**
1. Make sure variables are added to Environment Variables (not in Secrets for vars)
2. Use Secrets only for API keys
3. After changing variables in dashboard, click "Save and Deploy"

---

## 📖 Additional Resources

- [Cloudflare Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Wrangler Secrets](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [KV Storage](https://developers.cloudflare.com/kv/)

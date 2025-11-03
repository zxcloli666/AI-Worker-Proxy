# Private Configuration for Production

## ⚠️ IMPORTANT: Public Repository

This is a **public repository**. The `wrangler.toml` contains **example configuration only**.

Your real API keys and production routes should be set in **Cloudflare Dashboard**.

---

## 🔒 How It Works

The `wrangler.toml` has:

```toml
# Preserve Dashboard variables during deployment
keep_vars = true

[vars]
# Example configuration (for reference only)
PROXY_AUTH_TOKEN = "your-secret-proxy-token-here"
ROUTES_CONFIG = '''{ ... example routes ... }'''
```

**Key point:** `keep_vars = true` means:
- ✅ Dashboard variables are **NEVER** overwritten during deployment
- ✅ Dashboard values take **precedence** over wrangler.toml [vars]
- ✅ The [vars] in wrangler.toml serve as **examples only**

---

## 🚀 Setup for Production

### Step 1: Set Variables in Cloudflare Dashboard

1. Open: **Cloudflare Dashboard** → **Workers & Pages** → **ai-worker-proxy** → **Settings** → **Variables**

2. Add Environment Variable: **`ROUTES_CONFIG`**
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

3. Add Environment Variable: **`PROXY_AUTH_TOKEN`**
   ```
   your-real-secret-token
   ```

4. Add Encrypted Variables (Secrets):
   - Click **"Add variable"** → select **"Encrypt"**
   - Add your API keys:
     - `ANTHROPIC_KEY_1` = `sk-ant-xxxxx`
     - `GOOGLE_KEY_1` = `AIzaxxxxx`
     - `OPENAI_KEY_1` = `sk-xxxxx`
     - etc.

5. Click **"Save and Deploy"**

### Step 2: Deploy

Push to GitHub - GitHub Actions will deploy your code without touching Dashboard variables.

```bash
git push
```

**That's it!** Your private config is safe. `keep_vars = true` protects it.

---

## ⚙️ Local Development

Create `.dev.vars` file (not committed to git):

```bash
# .dev.vars
PROXY_AUTH_TOKEN=local-dev-token
ANTHROPIC_KEY_1=sk-ant-xxxxx
GOOGLE_KEY_1=AIzaxxxxx

ROUTES_CONFIG={"test": [{"provider": "anthropic", "model": "claude-opus-4", "apiKeys": ["ANTHROPIC_KEY_1"]}]}
```

Run locally:
```bash
npm run dev
```

---

## 🆘 Troubleshooting

### Problem: Config still gets overwritten

**Solution:**
1. Verify `wrangler.toml` has `keep_vars = true` (should be line 7)
2. Make sure you set variables in Dashboard, not just locally
3. After setting Dashboard variables, click "Save and Deploy"

### Problem: Variables not being read

**Solution:**
1. Environment variables (like `ROUTES_CONFIG`) go in "Environment Variables" section
2. API keys should be "Encrypted" (marked as Secret)
3. After changing Dashboard variables, click "Save and Deploy"
4. Wait ~30 seconds for changes to propagate

### Problem: Want to test without Dashboard

**Solution:**
1. Edit `wrangler.toml` [vars] section with your test config
2. Run `npm run dev` - it will use wrangler.toml values
3. Don't commit your changes to wrangler.toml!
4. Before pushing: `git restore wrangler.toml`

---

## 📋 Checklist

- [ ] `wrangler.toml` has `keep_vars = true` ✅
- [ ] All production variables set in Cloudflare Dashboard
- [ ] All API keys added as Encrypted variables
- [ ] Tested deployment - Dashboard config NOT overwritten
- [ ] `.dev.vars` created for local development (not committed)

---

## 📖 Resources

- [Cloudflare Environment Variables Docs](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Wrangler Configuration Docs](https://developers.cloudflare.com/workers/wrangler/configuration/)

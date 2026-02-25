# 🚀 AI Worker Proxy: All AI Models in One API (Free & 100% Uptime)

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-green)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Tired of your AI API keys running out of credits or getting rate-limited? Want to use Claude or Gemini but your app only supports OpenAI?

This is a **Free AI Gateway** that runs on Cloudflare Workers. It acts as a middleman: you send it an OpenAI-style request, and it routes it to **ChatGPT, Claude, Gemini, or even free local models**, rotating your API keys automatically so you never hit limits.

- **💰 Cost:** $0 (Runs on Cloudflare's free tier - 100k requests/day).
- **⚡ Setup time:** 5 minutes. No coding required.

---

## 🔥 Why You Need This

*   **100% Uptime (Failover):** If OpenAI goes down, it instantly switches to Claude or Gemini. Your app never stops working.
*   **Key Rotation:** Put in 5 different API keys. It will use them one by one. Bye-bye rate limits.
*   **One API to Rule Them All:** Talk to Anthropic Claude 3.5, Google Gemini 2.0, and GPT-4o using the exact same code.
*   **Stealth Configuration:** Change your routing logic via GitHub Variables without touching a single line of code.

---

## 🎮 How to Install (Easy Guide)

You don't need to know how to code. Just follow these 4 steps to get your own private AI proxy.

### Step 1: Fork this Repository
Scroll to the top right of this GitHub page and click the **"Fork"** button. This creates your own copy of the project.

### Step 2: Add Cloudflare Secrets to GitHub
Your GitHub needs permission to push the code to your Cloudflare account.

1. Go to your new forked repository.
2. Click **Settings** (top tab) -> **Secrets and variables** (left sidebar) -> **Actions**.
3. Click the green **"New repository secret"** button.

You need to add two secrets here:

*   **Secret 1 Name:** `CLOUDFLARE_ACCOUNT_ID`
    *   *Where to get it:* Log into [Cloudflare Dashboard](https://dash.cloudflare.com). Look at the URL bar. It's the long string of numbers/letters after `dash.cloudflare.com/`. Copy that.
*   **Secret 2 Name:** `CLOUDFLARE_API_TOKEN`
    *   *Where to get it:* Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens). Click **"Create Token"**. Select **"Edit Cloudflare Workers"** template. Click Continue -> Create Token. Copy the secret generated.

### Step 3: Launch the Action (Deploy)
1. Go to the **"Actions"** tab at the top of your GitHub repo.
2. Click "I understand my workflows, go ahead and enable them" (if asked).
3. On the left, click **"Deploy to Cloudflare"**.
4. Click **"Run workflow"** -> **"Run workflow"**.

Wait 1-2 minutes. When it turns green, your proxy is live! The URL will look like: `https://ai-proxy.YOUR-USERNAME.workers.dev`

### Step 4: Add Your AI Keys in Cloudflare
Now you just need to feed it your API keys (OpenAI, Claude, etc).

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click **"Workers & Pages"** on the left sidebar.
3. Click on your new worker (it should be named `ai-worker-proxy`).
4. Go to the **"Settings"** tab -> **"Variables and Secrets"** (on the left).
5. Under **Environment Variables**, click **"Add"**. Add these:

| Variable Name | Value (Example) | What is it? |
|--------------|-----------------|-------------|
| `PROXY_AUTH_TOKEN` | `my-secret-password-123` | Make up a password. You will use this to connect to your proxy. |
| `ANTHROPIC_KEY_1` | `sk-ant-xxx...` | Your Claude API Key |
| `GOOGLE_KEY_1` | `AIza...` | Your Google Gemini API Key |
| `OPENAI_KEY_1` | `sk-proj-...` | Your OpenAI API Key |

Click **Save and Deploy**. You're done! 🎉

---

## 🤫 Secret Routing Config (No Code Edits!)

You don't need to edit `wrangler.toml` or commit any code to change how your models behave. You can do it stealthily using **GitHub Variables**.

This allows you to update your model lists or failover logic without anyone seeing it in your file history.

1. Go to your GitHub Repo -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Click the **Variables** tab (next to Secrets).
3. Click **New repository variable**.
4. Name: `ROUTES_CONFIG`
5. Value: Paste your JSON configuration here.

**Example `ROUTES_CONFIG` JSON:**
```json
{
  "super-brain": [
    {
      "provider": "anthropic",
      "model": "claude-3-opus-20240229",
      "apiKeys": ["ANTHROPIC_KEY_1"]
    },
    {
      "provider": "openai",
      "model": "gpt-4-turbo",
      "apiKeys": ["OPENAI_KEY_1"]
    }
  ],
  "cheap-fast": [
    {
      "provider": "google",
      "model": "gemini-2.0-flash",
      "apiKeys": ["GOOGLE_KEY_1"]
    }
  ],
  "search": [
    {
      "provider": "google",
      "model": "gemini-3-flash-preview",
      "apiKeys": ["GOOGLE_KEY_1"],
      "grounding": true
    }
  ]
}
```

**How to apply changes:**
After saving the variable, just go to the **Actions** tab and run the **"Deploy to Cloudflare"** workflow again. It will inject your new config automatically.

---

## 🚀 How to Use It

Now you can use your proxy URL anywhere you normally use OpenAI.

### In Python:
```python
from openai import OpenAI

client = OpenAI(
    # 1. Put your Cloudflare Worker URL here + /v1
    base_url="https://ai-proxy.YOUR-USERNAME.workers.dev/v1",
    # 2. Put the PROXY_AUTH_TOKEN you created in Step 4 here
    api_key="my-secret-password-123" 
)

# Use the custom name you defined in ROUTES_CONFIG (e.g., "super-brain")
# Or use standard names like "gpt-4o"
response = client.chat.completions.create(
    model="super-brain", 
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

### In any App (like Chatbox, NextChat, typingmind):
*   **API URL / Base URL:** `https://ai-proxy.YOUR-USERNAME.workers.dev/v1`
*   **API Key:** `my-secret-password-123` (Your `PROXY_AUTH_TOKEN`)

---

## 🔒 Security Warning

**NEVER put your real API keys in the GitHub code.** Always put them in the Cloudflare Dashboard (Step 4). If you put them in the code, people will steal your keys.

---

## 💬 Support

Found a bug? Need help?
Open an issue in the [GitHub Issues](https://github.com/zxcloli666/AI-Worker-Proxy/issues) tab.

### ⭐ If this saved you money or time, please drop a Star on the repo! It helps a lot!

---

*Tags for search algorithms:* `openai proxy`, `ai gateway`, `api proxy`, `cloudflare workers ai`, `anthropic proxy`, `claude proxy`, `gemini proxy`, `multi provider ai`, `ai load balancer`, `openai compatible api`, `ai failover`, `free ai proxy`, `ai token rotation`, `gpt-4 proxy free`, `smm ai tools`, `bypass ai rate limit`

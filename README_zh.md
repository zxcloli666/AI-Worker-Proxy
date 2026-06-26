# 🚀 AI Worker Proxy: 一个 API 接入所有 AI 模型（免费且 100% 在线）

[![Deploy to Cloudflare Workers](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-green)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

厌倦了 AI API Key 额度用完或被限速？想让只支持 OpenAI SDK 的应用也能使用 Claude 或 Gemini？

这是一个运行在 Cloudflare Workers 上的 **免费 AI 网关**。它充当中间人：你传入 OpenAI 格式的请求，它会将请求路由到 **ChatGPT、Claude、Gemini 甚至免费本地模型**，并自动轮换你的 API Key 以避免限速。

- **💰 费用：** ¥0（运行在 Cloudflare 免费计划 - 每天 10 万次请求）。
- **⚡ 部署时间：** 5 分钟。无需写代码。

---

## 🔥 为什么需要它

- **100% 在线（故障转移）：** 如果 OpenAI 挂了，它立即切换到 Claude 或 Gemini。你的应用永不停机。
- **Key 轮换：** 放入 5 个不同的 API Key，它会逐个使用。告别限速。
- **一个 API 统治所有：** 用同一套代码调用 Anthropic Claude、Google Gemini 和 GPT-4o。
- **隐式配置：** 通过 GitHub Variable 修改路由逻辑，无需触碰代码。

---

## 🎮 安装指南（简单模式）

你不需要会写代码。只需 4 步就能拥有自己的私有 AI 代理。

### 第一步：Fork 本仓库

滚动到本 GitHub 页面右上角，点击 **"Fork"** 按钮。这会创建一份你专属的项目副本。

### 第二步：添加 Cloudflare 密钥到 GitHub

需要给 GitHub 授权，让它能推送代码到你的 Cloudflare 账号。

1. 进入你刚刚 Fork 的仓库
2. 点击 **Settings**（顶部标签）→ **Secrets and variables**（左侧）→ **Actions**
3. 点击绿色的 **"New repository secret"** 按钮

你需要添加两个密钥：

- **密钥 1 名称：** `CLOUDFLARE_ACCOUNT_ID`
  - *获取方式：* 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)。看浏览器地址栏，复制 `dash.cloudflare.com/` 后面那一长串数字字母。
- **密钥 2 名称：** `CLOUDFLARE_API_TOKEN`
  - *获取方式：* 前往 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)。点击 **"Create Token"**。选择 **"Edit Cloudflare Workers"** 模板。点击 Continue → Create Token。复制生成的密钥。

### 第三步：启动 Actions（部署）

1. 进入仓库的 **"Actions"** 标签页
2. 点击 "I understand my workflows, go ahead and enable them"（如果被询问）
3. 左侧点击 **"Deploy to Cloudflare"**
4. 点击 **"Run workflow"** → **"Run workflow"**

等待 1-2 分钟。变成绿色后，你的代理就上线了！URL 看起来像：`https://ai-proxy.YOUR-USERNAME.workers.dev`

### 第四步：在 Cloudflare 添加你的 AI Key

现在只需要填入你的 API Key（OpenAI、Claude 等）。

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击左侧的 **"Workers & Pages"**
3. 点击你的新 Worker（名字应该是 `ai-worker-proxy`）
4. 进入 **"Settings"** 标签 → **"Variables and Secrets"**（左侧）
5. 在 **Environment Variables** 下，点击 **"Add"**。添加以下内容：

| 变量名 | 值（示例） | 说明 |
|--------|-----------|------|
| `PROXY_AUTH_TOKEN` | `my-secret-password-123` | 自己设一个密码，连接代理时使用 |
| `ANTHROPIC_KEY_1` | `sk-ant-xxx...` | 你的 Claude API Key |
| `GOOGLE_KEY_1` | `AIza...` | 你的 Google Gemini API Key |
| `OPENAI_KEY_1` | `sk-proj-...` | 你的 OpenAI API Key |

点击 **Save and Deploy**。大功告成！🎉

---

## 🤫 秘密路由配置（无需改代码）

你不需要编辑 `wrangler.toml` 或提交代码来修改模型行为。通过 **GitHub Variable** 即可隐式完成。

这样你可以在不留下文件历史记录的情况下更新模型列表或故障转移逻辑。

1. 进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **Variables** 标签（在 Secrets 旁边）
3. 点击 **New repository variable**
4. 名称：`ROUTES_CONFIG`
5. 值：粘贴你的 JSON 配置

**`ROUTES_CONFIG` JSON 示例：**

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

**如何应用更改：**
保存变量后，进入 **Actions** 标签，重新运行 **"Deploy to Cloudflare"** 工作流。它会自动注入新配置。

---

## 🚀 如何使用

现在你可以在任何原本使用 OpenAI 的地方使用你的代理 URL。

### 在 Python 中使用：

```python
from openai import OpenAI

client = OpenAI(
    # 1. 将 URL 替换为你的 Cloudflare Worker 地址 + /v1
    base_url="https://ai-proxy.YOUR-USERNAME.workers.dev/v1",
    # 2. 将 api_key 替换为你在第四步创建的 PROXY_AUTH_TOKEN
    api_key="my-secret-password-123"
)

# 使用你在 ROUTES_CONFIG 中定义的名称（例如 "super-brain"）
response = client.chat.completions.create(
    model="super-brain",
    messages=[{"role": "user", "content": "你好！"}]
)
print(response.choices[0].message.content)
```

### 在任何应用中使用（如 Chatbox、NextChat、TypingMind）：

- **API 地址 / Base URL：** `https://ai-proxy.YOUR-USERNAME.workers.dev/v1`
- **API Key：** `my-secret-password-123`（你的 `PROXY_AUTH_TOKEN`）

---

## 🐘 Anthropic API 格式支持

你的代理也支持 **Anthropic Messages API 格式**！这意味着你可以直接用 `@anthropic-ai/sdk` 或任何支持 Anthropic 原生 API 的工具。

**端点地址：** `https://ai-proxy.YOUR-USERNAME.workers.dev/anthropic/`
**认证方式：** 与 OpenAI 格式相同，使用 `Authorization: Bearer` 或 `x-api-key` 请求头

### Python + Anthropic SDK：

```python
from anthropic import Anthropic

client = Anthropic(
    # 你的代理 URL + /anthropic
    base_url="https://ai-proxy.YOUR-USERNAME.workers.dev/anthropic",
    # 使用你的 PROXY_AUTH_TOKEN 作为 API Key
    api_key="my-secret-password-123"
)

message = client.messages.create(
    model="deep-think",
    max_tokens=1024,
    messages=[{"role": "user", "content": "你好，Claude！"}]
)
print(message.content[0].text)
```

### 使用 curl（非流式）：

```bash
curl -X POST https://ai-proxy.YOUR-USERNAME.workers.dev/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-password-123" \
  -d '{
    "model": "deep-think",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "你好！"}]
  }'
```

### 使用 curl（流式）：

```bash
curl -N -X POST https://ai-proxy.YOUR-USERNAME.workers.dev/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-password-123" \
  -d '{
    "model": "deep-think",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "从 1 数到 5"}],
    "stream": true
  }'
```

> **工作原理**：当你向使用了 `anthropic` 或 `anthropic-compatible` 类型 provider 的模型发送 Anthropic 格式请求时，代理会直接转发原始格式，不做任何转换——保留所有 Anthropic 特有的功能（system messages、content blocks、tool use、流式事件）。如果模型使用的是其他类型 provider（如 `openai` 或 `google`），代理会自动在格式之间进行转换。

---

## 🔧 添加新的 API 供应商（手动配置）

如果你想接入第三方 API 提供商，只要它兼容 OpenAI 或 Anthropic 协议，就**完全不需要修改代码**，仅通过配置即可完成。

### 第一步：添加 API Key

1. 进入 **Cloudflare Dashboard** → **Workers & Pages** → **ai-worker-proxy** → **Settings** → **Variables**
2. 点击 **"Add variable"** → 选择 **"Encrypt"**
3. 将你的 API Key 添加为加密变量，例如 `MY_PROVIDER_KEY`
4. 点击 **"Save and Deploy"**

### 第二步：更新 ROUTES_CONFIG

编辑 `ROUTES_CONFIG` 这个 GitHub Variable（或本地的 `wrangler.toml`），添加你的供应商路由：

```json
{
  "my-model": [
    {
      "provider": "openai-compatible",
      "baseUrl": "https://api.your-provider.com/v1",
      "model": "model-name",
      "apiKeys": ["MY_PROVIDER_KEY"]
    }
  ]
}
```

**Provider 类型参考表：**

| `provider` 值 | 使用场景 | 是否需要 `baseUrl` |
|---|---|---|
| `anthropic` | Anthropic 官方 API | 否 |
| `anthropic-compatible` | 第三方 Anthropic 兼容 API | **是** |
| `google` | Google Gemini API | 否 |
| `openai` | OpenAI 官方 API | 否 |
| `openai-compatible` | 第三方 OpenAI 兼容 API | **是** |
| `cloudflare-ai` | Cloudflare Workers AI 绑定 | 否 |

### 第三步：部署

推送任意提交到 `main` 分支（或手动在 Actions 中重新运行 **"Deploy to Cloudflare"** 工作流）。完成！

---

## 📋 ROUTES_CONFIG 字段说明

```json
{
  "路由名称": [
    {
      "provider": "供应商类型",
      "model": "模型名称",
      "apiKeys": ["环境变量名1", "环境变量名2"],
      "baseUrl": "API 地址（可选）",
      "grounding": true
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `路由名称`（键名） | 是 | 用户在请求时传入的 `model` 值 |
| `provider` | 是 | 供应商类型，见上表 |
| `model` | 是 | 传递给上游 API 的实际模型名称 |
| `apiKeys` | 是 | 环境变量名数组，系统会按顺序轮换尝试 |
| `baseUrl` | 特定情况 | OpenAI/Anthropic 兼容协议时必须填写 |
| `grounding` | 否 | 仅 Google 供应商可用，启用联网搜索 |

### 故障转移示例

以下配置中，如果第一个供应商失败，自动切换到第二个：

```json
{
  "smart-model": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKeys": ["OPENAI_KEY_1", "OPENAI_KEY_2"]
    },
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "apiKeys": ["ANTHROPIC_KEY_1"]
    }
  ]
}
```

如果所有供应商都失败，系统会返回错误信息。

---

## 🔒 安全警告

**永远不要把真实的 API Key 写在代码里。** 始终将它们保存在 Cloudflare Dashboard 中（见第四步）。写在代码里会被别人盗走。

---

## 💬 支持

发现 Bug？需要帮助？
在 [GitHub Issues](https://github.com/zxcloli666/AI-Worker-Proxy/issues) 中提交 issue。

### ⭐ 如果这个项目为你省了钱或时间，请在仓库点个 Star！非常感谢！

---

*搜索标签：* `openai proxy` `ai gateway` `api proxy` `cloudflare workers ai` `anthropic proxy` `claude proxy` `gemini proxy` `multi provider ai` `ai load balancer` `openai compatible api` `ai failover` `free ai proxy` `ai token rotation` `gpt-4 proxy` `ai 代理` `AI 网关`

# Security Policy

## 🔒 Reporting Security Vulnerabilities

**IMPORTANT: Do NOT create public issues for security vulnerabilities.**

Instead, please report security issues privately:
- Go to: https://github.com/loli669/AI-Worker-Proxy/security/advisories/new

We will respond within **48 hours**.

## ✅ Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Active support  |

## 🛡️ Security Best Practices

### For Users:
- **Never commit API keys** to the repository
- Store secrets in **Cloudflare Dashboard** (Workers → Settings → Variables)
- Use strong **PROXY_AUTH_TOKEN** (32+ random characters)
- Rotate tokens regularly
- Monitor Cloudflare Workers logs for suspicious activity

### For Contributors:
- Do not expose secrets in PRs
- Use `.dev.vars` for local development (add to `.gitignore`)
- Review code for potential security issues
- Follow principle of least privilege

## 🚨 Known Security Considerations

1. **CORS**: Enabled by default for all origins
   - Can be restricted in production by modifying `src/index.ts`
   
2. **Authentication**: Required for all endpoints except `/health`
   - Set `PROXY_AUTH_TOKEN` in Cloudflare Dashboard
   
3. **API Key Storage**: 
   - Stored as Cloudflare Worker secrets (encrypted at rest)
   - Never exposed in logs or responses
   
4. **Request Forwarding**: 
   - Proxy forwards requests to external AI APIs
   - Validate input before forwarding

## 📚 Security Resources

- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/platform/security/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)

## 🔄 Update Policy

Security patches are released as soon as possible. Update to the latest version to stay secure:
```bash
git pull origin main
npm run deploy
```

---

**Stay safe! 🔒**
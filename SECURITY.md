# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

We recommend always using the latest available version.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, **please do NOT open a public GitHub issue**.

Instead, report it responsibly:

1. **Email**: Send details to the maintainers via GitHub's private vulnerability reporting (recommended)
   - Navigate to the repository's **Security** tab
   - Click **"Report a vulnerability"**
   - Provide as much detail as possible

2. **Expected response time**: We aim to acknowledge reports within 48 hours and provide a timeline for fixes.

3. **What to include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Any suggested mitigations (optional)

## Known Security Considerations

### Input Validation

- All plugin outputs and external API responses should be treated as untrusted
- Schema validation is enforced through the Output Verifier plugin
- Never pass unsanitized user input directly to tool calls

### API Keys and Secrets

- **Do not hardcode API keys** in source code. Use environment variables:
  ```bash
  # Required environment variables (see .env.example)
  OPENAI_API_KEY=
  TELEGRAM_BOT_TOKEN=
  # etc.
  ```
- The `.env` file is gitignored but always verify before committing
- Rotate API keys regularly and revoke compromised keys immediately

### Network Security

- All outbound alert channels (Telegram, Slack, WeChat, Feishu, Email) use external APIs
- No inbound network listeners are opened by default
- Use TLS/HTTPS for all external communications where supported

### Data Storage

- Memory data is stored in-memory by default (plugin-specific)
- For production deployments, configure appropriate database backends
- No sensitive data is written to logs by default
- Clear memory/reset state appropriately when agent sessions end

### Plugin Isolation

- Plugins run in the same Node.js process; ensure trust before installing third-party plugins
- Review plugin source code before installation
- Use the Permission Sentinel plugin to control tool access

### Rate Limiting

- Alert channels may be subject to platform rate limits (Telegram, Slack, etc.)
- The Cognitive Governor plugin enforces token and cost limits
- Configure appropriate timeouts to prevent hanging connections

## Security Best Practices for Users

1. **Run `npm audit`** regularly to check for known vulnerabilities in dependencies
2. **Keep ARP updated** to receive security patches
3. **Restrict tool permissions** via the Permission Sentinel plugin
4. **Monitor alert channels** for unusual activity patterns
5. **Use environment variables** for all secrets, never hardcode them
6. **Review logs** for suspicious behavior (repeated failures, unexpected tool calls)

## Dependency Security

We aim to keep dependencies minimal and up-to-date. Run security audits:

```bash
npm audit
```

If a vulnerability is found in a transitive dependency, please report it alongside any fixes we can apply to our direct dependencies.

## Security Updates

Security patches are released as patch versions (e.g., 0.1.1). Major security overhauls would be minor versions (e.g., 0.2.0).

Subscribe to GitHub release notifications to stay informed about security updates.

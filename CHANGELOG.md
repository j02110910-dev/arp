# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-22

### Added

- **Smart Monitoring** — Loop detection, empty response detection, timeout detection, cron miss detection, behavior anomaly detection
- **Output Verification** — JSON Schema validation, API endpoint verification, screenshot verification (AI vision), E2E testing with veto mechanism, error detection
- **Memory Management** — Entity extraction, relationship mapping, knowledge graph storage, semantic search
- **Cognitive Governor** — Token budget enforcement, cost tracking per task, usage limits and burn rate alerts
- **Permission Sentinel** — Tool access control matrix, runtime permission checks, blocked tool alerting
- **Agent Stress Tester** — Concurrent agent simulation, load testing, failure mode validation
- **Alert Channels** — Console, Server酱 (WeChat), Telegram, Slack, Feishu, Email
- **Plugin System** — Extensible architecture for custom plugins
- **TypeScript Support** — Full type definitions (`dist/index.d.ts`)
- **Test Suite** — 159 tests covering all core functionality
- **Landing Page** — Documentation site with pricing and GitHub Pages deployment
- **Docker Support** — Dockerfile and docker-compose.yml for containerized deployment
- **ESLint Configuration** — TypeScript-aware linting with strict rules

### Initial Release

- Published as `arp` on npm
- Single-package solution for AI agent monitoring, verification, memory, and security
- Compatible with Node.js >= 18.0.0

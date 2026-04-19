# ARP - Agent Reliability Platform

AI Agent 的可靠性平台。监控、验证、记忆、安全，一个包全搞定。

```bash
npm install arp
```

---

## 功能详解

### 🔍 一、智能监控

Agent 执行任务时，ARP 实时监控整个过程，发现异常立即告警：

- **循环检测** — Agent 反复调用同一个工具 10 次以上没进展？立刻报警
- **空响应检测** — Agent 连续回复空内容或 NO_REPLY？说明卡死了，立刻报警
- **超时检测** — 单步操作超过 60 秒没响应？可能是 API 挂了，立刻报警
- **定时任务缺失** — 设了心跳任务但没按时触发？立刻报警
- **行为异常** — Agent 突然开始说"好的好的好的"？说明失去方向了，立刻报警

支持告警通知：微信（Server酱）、Telegram、Slack、飞书、邮件、控制台

### ✅ 二、输出验证

Agent 说"已完成"，但真的完成了吗？ARP 帮你验证：

- **Schema 验证** — 给一个 JSON 结构定义，检查 Agent 返回的数据格式对不对、字段全不全
- **API 验证** — Agent 调了 API 说成功了？ARP 独立查一遍，确认数据真的写进去了
- **截图验证** — Agent 说"页面已更新"？ARP 用 AI 视觉模型看截图，确认 UI 真的变了
- **E2E 验证** — 写测试用例，自动跑，Agent 的输出过不过关一测就知道
- **错误否决** — 输出里包含 "Error:" 或 "Exception"？直接判不合格

### 🧠 三、记忆治理

Agent 长对话跑久了会忘记前面说了什么，ARP 帮它记：

- **上下文压缩** — 50 条对话压缩成 15 条总结，节省 70% Token。支持 3 种压缩策略
- **指令锚点** — 把关键任务目标钉在 Prompt 末尾，不管对话多长，Agent 都不会忘
- **知识库** — Agent 解决了一个问题，自动存下来。下次遇到类似问题，直接查知识库

### 🛡️ 四、安全防护

Agent 可能会执行危险操作，ARP 在前面拦着：

- **危险命令拦截** — `rm -rf /`、`curl | bash`、`DROP TABLE`、`mkfs` 格式化磁盘，直接拦截
- **需确认操作** — `sudo`、`chmod 777`、访问 SSH 密钥，需要用户确认才执行
- **敏感数据脱敏** — 日志里的手机号、邮箱、API Key、密码、银行卡号、IP 地址，自动替换为占位符
- **自定义规则** — 支持添加自己的安全规则，白名单/黑名单

### 👥 五、多 Agent 管理

同时跑多个 Agent？一个 TeamARP 管所有：

- 添加任意数量的 Agent，每个独立配置
- 统一仪表盘：`http://localhost:3000/api/agents` 看所有 Agent 状态
- 统一告警收集：所有 Agent 的告警汇总到一起

---

## 安装

```bash
npm install arp
```

---

## 30 秒上手

```typescript
import { ARP } from 'arp';

const arp = new ARP();

// 监控
arp.watch.recordToolCall('search', {}, results, 120);
arp.watch.recordResponse('Found 42 results');

// 验证
await arp.verify({ output: { userId: 42 } }, { requiredFields: ['userId'] });

// 安全
arp.guard('rm -rf /');              // → { allowed: false, riskLevel: 'critical' }
arp.sanitize('Phone: 13812345678'); // → 'Phone: [PHONE_REDACTED]'

// 记忆
arp.compress(longConversation);     // 50条 → 15条
arp.anchor('完成注册流程', 10);     // 关键指令不丢失
arp.learn('JWT报错', '换token方案'); // 存经验
```

---

## 测试

159 个测试全部通过，涵盖所有功能。

## License

MIT

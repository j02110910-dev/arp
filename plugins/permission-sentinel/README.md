# Permission Sentinel

**Agent Reliability Platform - Part 4: Security Firewall**

在 Agent 和物理世界之间加一层智能防火墙。

## 功能

### ✅ 高危动作拦截
- `rm -rf /` → 直接拦截
- `curl | bash` → 直接拦截
- `DROP TABLE` → 直接拦截
- `mkfs/fdisk` → 直接拦截
- `chmod 777` → 需用户确认
- `sudo` → 需用户确认

### ✅ 敏感数据脱敏
- 手机号 → `[PHONE_REDACTED]`
- 邮箱 → `[EMAIL_REDACTED]`
- API Key → `[API_KEY_REDACTED]`
- 密码 → `[REDACTED]`
- 银行卡 → `[CARD_REDACTED]`
- IP 地址 → `[IP_REDACTED]`
- 支持自定义正则

### ✅ 安全规则系统
- 内置 10+ 安全规则
- 支持自定义规则
- 支持白名单/黑名单
- 三级响应：block / confirm / warn

## 安装

```bash
npm install @arp/permission-sentinel
```

## 使用

```typescript
import { PermissionSentinel, loadConfig } from '@arp/permission-sentinel';

const sentinel = new PermissionSentinel(loadConfig());

// 检查命令安全性
const result = sentinel.checkCommand('rm -rf /');
// → { riskLevel: 'critical', allowed: false, reason: '...' }

// 脱敏敏感数据
const sanitized = sentinel.sanitize('Phone: 13812345678');
// → { sanitized: 'Phone: [PHONE_REDACTED]', matches: [...] }
```

## 定价

| 套餐 | 价格 | 内容 |
|------|------|------|
| Free | $0 | 基础命令检查 + 5种脱敏 |
| Pro | $5/月 | 自定义规则 + 全部脱敏 + 历史记录 |
| Enterprise | $20/月 | 沙箱执行 + 人工审批 + 审计日志 |

## License

MIT

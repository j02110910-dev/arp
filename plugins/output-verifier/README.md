# Output Verifier

**Agent Reliability Platform - Part 2: Output Verification**

验证 Agent 输出是否真实完成，解决"说谎 Agent"问题。

---

## 功能

### ✅ Schema 验证
- JSON Schema 完整支持（type, properties, required, enum, min/max, pattern）
- 必填字段检查
- 占位符文本检测（TODO, FIXME, PLACEHOLDER）
- 空值/空字符串检测

### ✅ API 验证
- 检查工具调用是否返回结果
- 验证 API 状态码
- 独立探测 API 端点可达性
- 响应时间检查

### ✅ 工具调用验证
- 验证预期工具是否被调用
- 检查所有工具调用是否返回结果

### ✅ 验证报告
- 完整的验证历史记录
- 分项得分 + 总体得分
- 详细的问题定位
- 修复建议

---

## 安装

```bash
npm install output-verifier
```

---

## 使用

### 快速验证输出

```typescript
import { OutputVerifier, loadConfig } from 'output-verifier';

const verifier = new OutputVerifier(loadConfig());

// 验证输出是否符合 Schema
const result = await verifier.verifyOutput(
  { name: 'Alice', age: 30 },
  {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      email: { type: 'string' },
    },
    required: ['name', 'email'],
  }
);

console.log(result.status); // 'partial' (missing email)
console.log(result.score);  // 70
console.log(result.details); // [{ field: 'email', passed: false, message: '...' }]
```

### 完整 Claim 验证

```typescript
const report = await verifier.verify({
  id: 'claim-1',
  timestamp: new Date(),
  description: 'Agent 声称创建了用户并发送了邮件',
  output: { userId: 42, emailSent: true },
  toolCalls: [
    { tool: 'create_user', result: { id: 42 }, duration: 100 },
    { tool: 'send_email', result: { sent: true }, duration: 200 },
  ],
});

console.log(report.summary);
// ✅ All 1 verification(s) passed (score: 100/100)
```

### 验证工具调用

```typescript
const result = await verifier.verifyToolCalls([
  { tool: 'search', result: [{ id: 1 }] },
  { tool: 'update', result: { affected: 1 } },
], ['search', 'update']);

console.log(result.status); // 'passed'
```

---

## Schema 验证支持

| 类型 | 检查项 |
|------|--------|
| `type` | 字符串/数字/布尔/对象/数组 |
| `properties` | 对象属性递归验证 |
| `required` | 必填字段检查 |
| `enum` | 枚举值验证 |
| `minLength/maxLength` | 字符串长度 |
| `pattern` | 正则表达式匹配 |
| `minimum/maximum` | 数值范围 |
| `minItems/maxItems` | 数组长度 |
| `items` | 数组元素递归验证 |
| `additionalProperties` | 禁止额外属性 |

---

## 与 SilentWatch 集成

```typescript
import { SilentWatchMonitor } from 'silent-watch';
import { OutputVerifier } from 'output-verifier';

const monitor = new SilentWatchMonitor(config);
const verifier = new OutputVerifier(verifierConfig);

// 当 SilentWatch 检测到 Agent 声称完成任务时
monitor.onAlert(async (alert) => {
  if (alert.type === 'anomaly' && alert.details.fabricationScore > 0) {
    // 触发输出验证
    const report = await verifier.verify(alert.context.recentEvents);
    console.log(report.summary);
  }
});
```

---

## 定价

| 套餐 | 价格 | 内容 |
|------|------|------|
| Free | $0 | 每月 20 次 Schema 验证 |
| Pro | $50/月 | 无限验证 + API 验证 + 历史记录 |
| Enterprise | $50/月 | E2E 测试 + 截图验证 + 团队协作 |

---

## License

MIT

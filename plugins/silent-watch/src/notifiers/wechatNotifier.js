"use strict";
/**
 * WeChat Notifier (via Server酱)
 * Sends alerts to WeChat using Server酱 push service
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeChatNotifier = void 0;
const axios_1 = __importDefault(require("axios"));
class WeChatNotifier {
    server酱Key;
    enabled;
    constructor(config) {
        this.enabled = config?.enabled || false;
        this.server酱Key = config?.server酱Key || '';
    }
    async send(alert) {
        if (!this.enabled || !this.server酱Key) {
            return;
        }
        const severityEmoji = alert.severity === 'critical' ? '🔴 严重' :
            alert.severity === 'high' ? '🟠 高' :
                alert.severity === 'medium' ? '🟡 中' : '🔵 低';
        const content = [
            `${severityEmoji} SilentWatch 告警`,
            ``,
            `类型: ${alert.type}`,
            `消息: ${alert.message}`,
            ``,
            `时间: ${alert.timestamp.toLocaleString('zh-CN')}`,
            ``,
            alert.context.suggestedFix ? `💡 建议:\n${alert.context.suggestedFix}` : '',
        ].filter(Boolean).join('\n');
        try {
            await axios_1.default.post(`https://sctapi.ftqq.com/${this.server酱Key}.send`, {
                title: `[${alert.severity.toUpperCase()}] ${alert.message.substring(0, 50)}`,
                content,
                sign: 'SilentWatch',
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('[WeChatNotifier] Failed to send notification:', {
                    error: error.message,
                    alertType: alert.type,
                    serverKey: this.server酱Key?.substring(0, 8) + '...',
                });
            }
            else {
                console.error('[WeChatNotifier] Failed to send notification:', {
                    error: String(error),
                    alertType: alert.type,
                });
            }
        }
    }
}
exports.WeChatNotifier = WeChatNotifier;
//# sourceMappingURL=wechatNotifier.js.map
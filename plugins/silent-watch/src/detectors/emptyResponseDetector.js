"use strict";
/**
 * Empty Response Detector
 * Detects when agent returns empty or NO_REPLY responses consecutively
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyResponseDetector = void 0;
class EmptyResponseDetector {
    name = 'empty_response_detector';
    config;
    recentResponses = [];
    constructor(config) {
        this.config = {
            maxConsecutiveEmpty: config.maxConsecutiveEmpty || 3,
            contextSnapshotSize: config.contextSnapshotSize || 10,
        };
    }
    check(events) {
        // Only consider response-type events, NOT tool_call/cron_trigger/etc.
        const responseEvents = events.filter(e => e.type === 'normal' || e.type === 'empty_response');
        const recentEvents = responseEvents.slice(-this.config.contextSnapshotSize);
        // Track consecutive empty responses from the end
        let consecutiveEmpty = 0;
        let consecutiveNO_REPLY = 0;
        for (let i = recentEvents.length - 1; i >= 0; i--) {
            const event = recentEvents[i];
            const isEmptyResponse = event.type === 'empty_response' ||
                event.content === '' ||
                (event.responseLength !== undefined && event.responseLength === 0);
            const isNO_REPLY = event.content === 'NO_REPLY';
            if (isEmptyResponse || isNO_REPLY) {
                if (isEmptyResponse)
                    consecutiveEmpty++;
                if (isNO_REPLY)
                    consecutiveNO_REPLY++;
            }
            else {
                // Found a meaningful response - stop counting
                break;
            }
        }
        // Trigger alert for consecutive empty responses
        if (consecutiveEmpty >= this.config.maxConsecutiveEmpty) {
            let severity;
            if (consecutiveNO_REPLY >= this.config.maxConsecutiveEmpty * 2) {
                severity = 'critical';
            }
            else if (consecutiveEmpty >= this.config.maxConsecutiveEmpty * 1.5) {
                severity = 'high';
            }
            else {
                severity = 'medium';
            }
            return {
                triggered: true,
                alertType: 'empty_response',
                severity,
                message: `静默失败：连续 ${consecutiveEmpty} 次无实质输出（可能已卡死）`,
                details: {
                    consecutiveEmpty,
                    consecutiveNO_REPLY,
                    maxAllowed: this.config.maxConsecutiveEmpty,
                    recentEventsCount: recentEvents.length,
                },
                suggestedFix: [
                    'Agent 可能已陷入静默状态',
                    '建议手动检查 Agent 运行状态',
                    '考虑重启 Agent 会话',
                    `可设置 SILENT_WATCH_MAX_CONSECUTIVE_EMPTY 环境变量来调整阈值`,
                ].join('\n'),
            };
        }
        return { triggered: false };
    }
    reset() {
        this.recentResponses = [];
    }
}
exports.EmptyResponseDetector = EmptyResponseDetector;
//# sourceMappingURL=emptyResponseDetector.js.map
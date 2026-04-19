"use strict";
/**
 * Loop Detector
 * Detects when the same tool is called repeatedly without progress
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopDetector = void 0;
class LoopDetector {
    name = 'loop_detector';
    config;
    consecutiveSameResultCount = new Map();
    lastToolResults = new Map();
    // Track which tools have already been alerted to prevent duplicate alerts
    alertedTools = new Set();
    constructor(config) {
        this.config = {
            maxConsecutiveCalls: config.maxConsecutiveCalls || 10,
            contextSnapshotSize: config.contextSnapshotSize || 10,
        };
    }
    check(events) {
        const toolCallEvents = events.filter(e => e.type === 'tool_call');
        if (toolCallEvents.length < 2) {
            return { triggered: false };
        }
        // Get the most recent tool call
        const lastToolEvent = toolCallEvents[toolCallEvents.length - 1];
        const toolName = lastToolEvent.tool || 'unknown';
        // Count consecutive calls to the same tool (from the end)
        let consecutiveCalls = 0;
        for (let i = toolCallEvents.length - 1; i >= 0; i--) {
            if (toolCallEvents[i].tool === toolName) {
                consecutiveCalls++;
            }
            else {
                break;
            }
        }
        // Update same-result tracking
        const lastResult = lastToolEvent.metadata?.result;
        if (lastResult !== undefined) {
            const previousResult = this.lastToolResults.get(toolName);
            const lastSameResultCount = this.consecutiveSameResultCount.get(toolName) || 0;
            if (previousResult === lastResult) {
                this.consecutiveSameResultCount.set(toolName, lastSameResultCount + 1);
            }
            else {
                this.consecutiveSameResultCount.set(toolName, 0);
            }
            this.lastToolResults.set(toolName, lastResult);
        }
        const sameResultCount = this.consecutiveSameResultCount.get(toolName) || 0;
        // Determine if we should alert
        const tooManyCalls = consecutiveCalls >= this.config.maxConsecutiveCalls;
        // noProgress: same result for at least half of max calls, AND at least 3 calls
        const noProgress = sameResultCount >= this.config.maxConsecutiveCalls / 2 &&
            consecutiveCalls >= 3;
        if (tooManyCalls || noProgress) {
            // Don't re-alert for the same tool until it stops being called consecutively
            if (this.alertedTools.has(toolName)) {
                return { triggered: false };
            }
            // Determine severity based on how many times in a row
            let severity = 'medium';
            if (consecutiveCalls >= this.config.maxConsecutiveCalls * 3) {
                severity = 'critical';
            }
            else if (consecutiveCalls >= this.config.maxConsecutiveCalls * 2) {
                severity = 'high';
            }
            // Mark this tool as alerted
            this.alertedTools.add(toolName);
            return {
                triggered: true,
                alertType: 'loop_detected',
                severity,
                message: `疑似循环：工具 "${toolName}" 已被连续调用 ${consecutiveCalls} 次且无进展`,
                details: {
                    toolName,
                    consecutiveCalls,
                    maxAllowed: this.config.maxConsecutiveCalls,
                    sameResultCount,
                    recentEventsCount: toolCallEvents.length,
                },
                suggestedFix: [
                    `检查工具 "${toolName}" 是否陷入了死循环`,
                    '考虑终止当前任务并重新开始',
                    `可设置 SILENT_WATCH_MAX_CONSECUTIVE_CALLS 环境变量来调整阈值`,
                ].join('\n'),
            };
        }
        // If this tool is no longer being called consecutively, clear its alert state
        if (consecutiveCalls === 1 && this.alertedTools.has(toolName)) {
            this.alertedTools.delete(toolName);
            this.consecutiveSameResultCount.delete(toolName);
        }
        return { triggered: false };
    }
    reset() {
        this.consecutiveSameResultCount.clear();
        this.lastToolResults.clear();
        this.alertedTools.clear();
    }
}
exports.LoopDetector = LoopDetector;
//# sourceMappingURL=loopDetector.js.map
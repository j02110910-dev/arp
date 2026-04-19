"use strict";
/**
 * Anomaly Detector
 * Detects anomalous behavior patterns like evasive language, repetition, behavior drift
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalyDetector = void 0;
// Evasive/phrases that suggest agent is losing direction
const EVASIVE_PATTERNS = [
    '好的好的',
    '收到收到',
    '没问题没问题',
    '我明白了我明白了',
    '好的 我再试一次',
    '让我再想想',
    '让我重新',
    '等等让我',
    '其实我刚才',
    '其实这个',
];
// Patterns suggesting the agent is stuck in a loop
const LOOP_INDICATORS = [
    '让我再',
    '我再重新',
    '让我重新',
    '我再试',
];
// Patterns suggesting the agent is fabricating
const FABRICATION_INDICATORS = [
    '已完成',
    '已成功',
    '已经完成',
    '已经搞定了',
    '完美解决',
];
class AnomalyDetector {
    name = 'anomaly_detector';
    config;
    maxHistorySize = 20;
    constructor(config) {
        this.config = {
            contextSnapshotSize: config.contextSnapshotSize || 10,
        };
    }
    check(events) {
        // Only consider response-type events for content analysis
        const responseEvents = events.filter(e => e.type === 'normal' || e.type === 'empty_response');
        const recentEvents = responseEvents.slice(-this.config.contextSnapshotSize);
        // Check for evasive language patterns
        let evasiveScore = 0;
        let loopScore = 0;
        let fabricationScore = 0;
        let lastContent = '';
        for (const event of recentEvents) {
            if (event.content) {
                lastContent = event.content;
                // Check evasive patterns
                for (const pattern of EVASIVE_PATTERNS) {
                    if (event.content.includes(pattern)) {
                        evasiveScore++;
                    }
                }
                // Check loop indicators
                for (const pattern of LOOP_INDICATORS) {
                    if (event.content.includes(pattern)) {
                        loopScore++;
                    }
                }
                // Check fabrication indicators (without actual verification)
                for (const pattern of FABRICATION_INDICATORS) {
                    if (event.content.includes(pattern)) {
                        fabricationScore++;
                    }
                }
            }
        }
        // Detect content repetition within current check's events only
        const contentCounts = new Map();
        for (const event of recentEvents) {
            if (event.content) {
                const trimmed = event.content.trim();
                if (trimmed.length > 10) {
                    contentCounts.set(trimmed, (contentCounts.get(trimmed) || 0) + 1);
                }
            }
        }
        let maxRepetition = 0;
        let mostRepeatedContent = '';
        for (const [content, count] of contentCounts) {
            if (count > maxRepetition) {
                maxRepetition = count;
                mostRepeatedContent = content.substring(0, 100);
            }
        }
        // Determine severity and build message
        const totalScore = evasiveScore + loopScore + fabricationScore;
        if (totalScore >= 5 || evasiveScore >= 3 || fabricationScore >= 3) {
            const severity = totalScore >= 10 ? 'critical' :
                totalScore >= 7 ? 'high' :
                    totalScore >= 5 ? 'medium' : 'low';
            const issues = [];
            if (evasiveScore > 0)
                issues.push(`敷衍语气 (${evasiveScore}次)`);
            if (loopScore > 0)
                issues.push(`重复尝试 (${loopScore}次)`);
            if (fabricationScore > 0)
                issues.push(`未验证的完成声明 (${fabricationScore}次)`);
            return {
                triggered: true,
                alertType: 'anomaly',
                severity,
                message: `异常行为模式：检测到 ${issues.join('、')}，Agent 可能失去方向或开始说谎`,
                details: {
                    evasiveScore,
                    loopScore,
                    fabricationScore,
                    totalScore,
                    maxRepetition,
                    mostRepeatedContent,
                    recentContent: lastContent.substring(0, 200),
                },
                suggestedFix: [
                    'Agent 表现出异常行为模式',
                    '建议立即检查 Agent 最新输出',
                    '如果声称已完成但未验证，应触发输出验证',
                    '考虑重新初始化 Agent 会话',
                ].join('\n'),
            };
        }
        // Check for high repetition within current events (not accumulated)
        if (maxRepetition >= 3 && recentEvents.length >= 5) {
            return {
                triggered: true,
                alertType: 'anomaly',
                severity: 'low',
                message: `行为漂移：检测到相同内容重复 ${maxRepetition} 次`,
                details: {
                    maxRepetition,
                    mostRepeatedContent,
                    recentEventsCount: recentEvents.length,
                },
                suggestedFix: [
                    'Agent 开始重复相同内容',
                    '可能陷入生成循环',
                    '建议检查是否需要重新初始化上下文',
                ].join('\n'),
            };
        }
        return { triggered: false };
    }
    reset() {
        // No state to reset - this detector only analyzes current events
    }
}
exports.AnomalyDetector = AnomalyDetector;
//# sourceMappingURL=anomalyDetector.js.map
"use strict";
/**
 * Console Notifier
 * Outputs alerts to console with formatting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleNotifier = void 0;
class ConsoleNotifier {
    level;
    constructor(level = 'info') {
        this.level = level;
    }
    async send(alert) {
        const timestamp = alert.timestamp.toISOString();
        const severity = alert.severity.toUpperCase().padEnd(8);
        const type = alert.type.toUpperCase().padEnd(15);
        const prefix = `[${timestamp}] [${severity}] [${type}]`;
        switch (this.level) {
            case 'error':
                if (alert.severity === 'critical' || alert.severity === 'high') {
                    console.error(`${prefix} 🚨 ${alert.message}`);
                }
                else {
                    console.warn(`${prefix} ⚠️  ${alert.message}`);
                }
                break;
            case 'warn':
                console.warn(`${prefix} ⚠️  ${alert.message}`);
                break;
            default:
                const emoji = alert.severity === 'critical' ? '🔴' :
                    alert.severity === 'high' ? '🟠' :
                        alert.severity === 'medium' ? '🟡' : '🔵';
                console.log(`${prefix} ${emoji} ${alert.message}`);
        }
        // Print details if present
        if (Object.keys(alert.details).length > 0) {
            console.log(`  详情:`, JSON.stringify(alert.details, null, 2));
        }
        if (alert.context.suggestedFix) {
            console.log(`  💡 建议:\n    ${alert.context.suggestedFix.split('\n').join('\n    ')}`);
        }
    }
}
exports.ConsoleNotifier = ConsoleNotifier;
//# sourceMappingURL=consoleNotifier.js.map
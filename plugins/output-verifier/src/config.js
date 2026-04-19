"use strict";
/**
 * Output Verifier - Configuration Management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfig = getDefaultConfig;
exports.loadConfig = loadConfig;
try {
    require('dotenv').config();
}
catch { }
function getDefaultConfig() {
    return {
        enabled: true,
        strictness: 'standard',
        verifiers: {
            schema: { enabled: true },
            data: { enabled: true, timeoutMs: 10000 },
            api: { enabled: true, timeoutMs: 10000 },
            screenshot: { enabled: false },
            e2e: { enabled: false },
        },
        notifiers: {
            console: { enabled: true, level: 'info' },
        },
        reportPath: './verification-reports.json',
        maxReports: 100,
    };
}
function loadConfig(overrides) {
    const config = getDefaultConfig();
    // Environment variable overrides
    if (process.env.OUTPUT_VERIFIER_ENABLED === 'false') {
        config.enabled = false;
    }
    if (process.env.OUTPUT_VERIFIER_STRICTNESS) {
        config.strictness = process.env.OUTPUT_VERIFIER_STRICTNESS;
    }
    if (process.env.OUTPUT_VERIFIER_REPORT_PATH) {
        config.reportPath = process.env.OUTPUT_VERIFIER_REPORT_PATH;
    }
    // API verifier config from env
    if (process.env.OUTPUT_VERIFIER_API_URL) {
        config.verifiers.api = {
            ...config.verifiers.api,
            enabled: true,
            baseUrl: process.env.OUTPUT_VERIFIER_API_URL,
            apiKey: process.env.OUTPUT_VERIFIER_API_KEY,
        };
    }
    // Screenshot verifier config from env
    if (process.env.OUTPUT_VERIFIER_VISION_API_KEY) {
        config.verifiers.screenshot = {
            ...config.verifiers.screenshot,
            enabled: true,
            apiKey: process.env.OUTPUT_VERIFIER_VISION_API_KEY,
        };
    }
    // WeChat notification
    if (process.env.SERVER_CHAN_KEY) {
        config.notifiers = {
            ...config.notifiers,
            wechat: { enabled: true, server酱Key: process.env.SERVER_CHAN_KEY },
        };
    }
    // Telegram notification
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        config.notifiers = {
            ...config.notifiers,
            telegram: {
                enabled: true,
                botToken: process.env.TELEGRAM_BOT_TOKEN,
                chatId: process.env.TELEGRAM_CHAT_ID,
            },
        };
    }
    // Apply overrides
    if (overrides) {
        Object.assign(config, overrides);
    }
    return config;
}
//# sourceMappingURL=config.js.map
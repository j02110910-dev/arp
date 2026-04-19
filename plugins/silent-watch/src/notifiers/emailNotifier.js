"use strict";
/**
 * Email Notifier
 * Sends alerts via SMTP email using nodemailer
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailNotifier = void 0;
const nodemailer = __importStar(require("nodemailer"));
class EmailNotifier {
    smtpHost;
    smtpPort;
    smtpUser;
    smtpPass;
    toEmail;
    fromEmail;
    enabled;
    transporter = null;
    constructor(config) {
        this.enabled = config?.enabled || false;
        this.smtpHost = config?.smtpHost || '';
        this.smtpPort = config?.smtpPort || 587;
        this.smtpUser = config?.smtpUser || '';
        this.smtpPass = config?.smtpPass || '';
        this.toEmail = config?.toEmail || '';
        this.fromEmail = config?.fromEmail || this.smtpUser;
        // Initialize transporter if enabled
        if (this.enabled && this.smtpHost && this.smtpUser) {
            this.initializeTransporter();
        }
    }
    initializeTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                host: this.smtpHost,
                port: this.smtpPort,
                secure: this.smtpPort === 465, // true for 465, false for other ports
                auth: {
                    user: this.smtpUser,
                    pass: this.smtpPass,
                },
            });
            console.log('[EmailNotifier] SMTP transporter initialized');
        }
        catch (error) {
            console.error('[EmailNotifier] Failed to initialize SMTP transporter:', error);
        }
    }
    async send(alert) {
        if (!this.enabled || !this.transporter || !this.toEmail) {
            return;
        }
        const severityLabel = {
            critical: '🔴 CRITICAL',
            high: '🟠 HIGH',
            medium: '🟡 MEDIUM',
            low: '🔵 LOW',
        }[alert.severity];
        const subject = `[SilentWatch] ${severityLabel} - ${alert.message.substring(0, 60)}`;
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
    .alert { padding: 20px; border-radius: 8px; margin: 20px 0; }
    .critical { background-color: #fee2e2; border: 1px solid #ef4444; }
    .high { background-color: #ffedd5; border: 1px solid #f97316; }
    .medium { background-color: #fef9c3; border: 1px solid #eab308; }
    .low { background-color: #dbeafe; border: 1px solid #3b82f6; }
    .label { font-weight: bold; display: inline-block; width: 80px; }
    pre { background: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .suggestion { background: #f0fdf4; padding: 15px; border-radius: 4px; border: 1px solid #22c55e; }
  </style>
</head>
<body>
  <h2>🚨 SilentWatch 告警通知</h2>

  <div class="alert ${alert.severity}">
    <p><span class="label">严重程度:</span> ${severityLabel}</p>
    <p><span class="label">告警类型:</span> ${alert.type}</p>
    <p><span class="label">消息:</span> ${alert.message}</p>
    <p><span class="label">时间:</span> ${alert.timestamp.toLocaleString('zh-CN')}</p>
  </div>

  ${Object.keys(alert.details).length > 0 ? `
  <h3>📋 详细信息</h3>
  <pre>${JSON.stringify(alert.details, null, 2)}</pre>
  ` : ''}

  ${alert.context.suggestedFix ? `
  <div class="suggestion">
    <h3>💡 修复建议</h3>
    <pre>${alert.context.suggestedFix}</pre>
  </div>
  ` : ''}
</body>
</html>
    `.trim();
        try {
            const info = await this.transporter.sendMail({
                from: this.fromEmail,
                to: this.toEmail,
                subject,
                html: htmlContent,
                text: this.htmlToText(htmlContent),
            });
            console.log(`[EmailNotifier] Email sent: ${info.messageId}`);
        }
        catch (error) {
            console.error('[EmailNotifier] Failed to send email notification:', error);
        }
    }
    /**
     * Simple HTML to text conversion for plain text fallback
     */
    htmlToText(html) {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }
}
exports.EmailNotifier = EmailNotifier;
//# sourceMappingURL=emailNotifier.js.map
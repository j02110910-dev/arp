/**
 * Email Notifier
 * Sends alerts via SMTP email using nodemailer
 */

import { Alert, NotifierConfig } from '../config';
import * as nodemailer from 'nodemailer';

export class EmailNotifier {
  private smtpHost: string;
  private smtpPort: number;
  private smtpUser: string;
  private smtpPass: string;
  private toEmail: string;
  private fromEmail: string;
  private enabled: boolean;
  private transporter: nodemailer.Transporter | null = null;

  constructor(config: NotifierConfig['email']) {
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

  private initializeTransporter(): void {
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
    } catch (error) {
      console.error('[EmailNotifier] Failed to initialize SMTP transporter:', error);
    }
  }

  async send(alert: Alert): Promise<void> {
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
    } catch (error) {
      console.error('[EmailNotifier] Failed to send email notification:', error);
    }
  }

  /**
   * Simple HTML to text conversion for plain text fallback
   */
  private htmlToText(html: string): string {
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

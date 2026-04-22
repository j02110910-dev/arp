/**
 * Slack Notifier
 * Sends alerts to Slack via Incoming Webhook
 */

import { logger } from './logger';

export class SlackNotifier {
  private webhookUrl: string;
  private enabled: boolean;

  constructor(config?: { enabled?: boolean; webhookUrl?: string }) {
    this.enabled = config?.enabled || false;
    this.webhookUrl = config?.webhookUrl || '';
  }

  async send(alert: {
    severity: string;
    type: string;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.enabled || !this.webhookUrl) return;

    const emoji = alert.severity === 'critical' ? '🔴' :
                  alert.severity === 'high' ? '🟠' :
                  alert.severity === 'medium' ? '🟡' : '🔵';

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} *ARP Alert* [${alert.severity.toUpperCase()}]\n*Type:* ${alert.type}\n*Message:* ${alert.message}`,
        }),
      });
    } catch (err) {
      logger.error('Failed to send Slack notification', { error: String(err), alertType: alert.type });
    }
  }
}

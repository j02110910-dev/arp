/**
 * 飞书 Notifier
 * Sends alerts to Feishu/Lark via Incoming Webhook
 */

export class FeishuNotifier {
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

    const color = alert.severity === 'critical' ? 'red' :
                  alert.severity === 'high' ? 'orange' :
                  alert.severity === 'medium' ? 'yellow' : 'blue';

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'interactive',
          card: {
            header: {
              title: { tag: 'plain_text', content: `ARP 告警 [${alert.severity.toUpperCase()}]` },
              template: color,
            },
            elements: [
              {
                tag: 'div',
                text: {
                  tag: 'lark_md',
                  content: `**类型:** ${alert.type}\n**消息:** ${alert.message}`,
                },
              },
            ],
          },
        }),
      });
    } catch (err) {
      console.error('[FeishuNotifier] Failed to send:', err);
    }
  }
}

/**
 * Telegram Notifier
 * Sends alerts to Telegram via Bot API
 */

import axios from 'axios';
import { Alert, NotifierConfig } from '../config';

export class TelegramNotifier {
  private botToken: string;
  private chatId: string;
  private enabled: boolean;

  constructor(config: NotifierConfig['telegram']) {
    this.enabled = config?.enabled || false;
    this.botToken = config?.botToken || '';
    this.chatId = config?.chatId || '';
  }

  async send(alert: Alert): Promise<void> {
    if (!this.enabled || !this.botToken || !this.chatId) {
      return;
    }

    const severityEmoji = alert.severity === 'critical' ? '🔴' :
                          alert.severity === 'high' ? '🟠' :
                          alert.severity === 'medium' ? '🟡' : '🔵';

    let message = [
      `${severityEmoji} *SilentWatch 告警*`,
      ``,
      `*类型:* \`${alert.type}\``,
      ``,
      `*消息:* ${alert.message}`,
      ``,
      `*时间:* ${alert.timestamp.toLocaleString('zh-CN')}`,
    ].join('\n');

    if (alert.context.suggestedFix) {
      message += [
        ``,
        `*💡 建议:*`,
        `${alert.context.suggestedFix}`,
      ].join('\n');
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error('[TelegramNotifier] Failed to send notification:', {
          error: error.message,
          alertType: alert.type,
          chatId: this.chatId,
        });
      } else {
        console.error('[TelegramNotifier] Failed to send notification:', {
          error: String(error),
          alertType: alert.type,
          chatId: this.chatId,
        });
      }
    }
  }
}

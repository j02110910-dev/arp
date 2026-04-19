/**
 * Telegram Notifier
 * Sends alerts to Telegram via Bot API
 */
import { Alert, NotifierConfig } from '../config';
export declare class TelegramNotifier {
    private botToken;
    private chatId;
    private enabled;
    constructor(config: NotifierConfig['telegram']);
    send(alert: Alert): Promise<void>;
}

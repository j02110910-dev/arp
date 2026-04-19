/**
 * Console Notifier
 * Outputs alerts to console with formatting
 */
import { Alert } from '../config';
export declare class ConsoleNotifier {
    private level;
    constructor(level?: 'debug' | 'info' | 'warn' | 'error');
    send(alert: Alert): Promise<void>;
}

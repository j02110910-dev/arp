/**
 * Email Notifier
 * Sends alerts via SMTP email using nodemailer
 */
import { Alert, NotifierConfig } from '../config';
export declare class EmailNotifier {
    private smtpHost;
    private smtpPort;
    private smtpUser;
    private smtpPass;
    private toEmail;
    private fromEmail;
    private enabled;
    private transporter;
    constructor(config: NotifierConfig['email']);
    private initializeTransporter;
    send(alert: Alert): Promise<void>;
    /**
     * Simple HTML to text conversion for plain text fallback
     */
    private htmlToText;
}

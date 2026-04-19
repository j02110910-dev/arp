/**
 * WeChat Notifier (via Server酱)
 * Sends alerts to WeChat using Server酱 push service
 */
import { Alert, NotifierConfig } from '../config';
export declare class WeChatNotifier {
    private server酱Key;
    private enabled;
    constructor(config: NotifierConfig['wechat']);
    send(alert: Alert): Promise<void>;
}

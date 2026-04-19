"use strict";
/**
 * SilentWatch - Agent Reliability Platform
 * Silent Failure Detector for AI Agents
 *
 * @example
 * import { SilentWatchMonitor, loadConfig } from 'silent-watch';
 *
 * const config = loadConfig();
 * const monitor = new SilentWatchMonitor(config);
 *
 * // Record events
 * monitor.recordToolCall('search_database', { query: 'users' }, results, 150);
 * monitor.recordResponse('Found 42 users matching your query');
 *
 * // Get stats
 * console.log(monitor.getStats());
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailNotifier = exports.TelegramNotifier = exports.WeChatNotifier = exports.ConsoleNotifier = exports.AnomalyDetector = exports.CronMissedDetector = exports.TimeoutDetector = exports.EmptyResponseDetector = exports.LoopDetector = exports.SilentWatchMonitor = exports.debugLog = exports.isDebug = exports.DEFAULT_CONFIG = exports.getDefaultConfigPath = exports.loadConfig = void 0;
var config_1 = require("./config");
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return config_1.loadConfig; } });
Object.defineProperty(exports, "getDefaultConfigPath", { enumerable: true, get: function () { return config_1.getDefaultConfigPath; } });
Object.defineProperty(exports, "DEFAULT_CONFIG", { enumerable: true, get: function () { return config_1.DEFAULT_CONFIG; } });
Object.defineProperty(exports, "isDebug", { enumerable: true, get: function () { return config_1.isDebug; } });
Object.defineProperty(exports, "debugLog", { enumerable: true, get: function () { return config_1.debugLog; } });
var monitor_1 = require("./monitor");
Object.defineProperty(exports, "SilentWatchMonitor", { enumerable: true, get: function () { return monitor_1.SilentWatchMonitor; } });
var detectors_1 = require("./detectors");
Object.defineProperty(exports, "LoopDetector", { enumerable: true, get: function () { return detectors_1.LoopDetector; } });
Object.defineProperty(exports, "EmptyResponseDetector", { enumerable: true, get: function () { return detectors_1.EmptyResponseDetector; } });
Object.defineProperty(exports, "TimeoutDetector", { enumerable: true, get: function () { return detectors_1.TimeoutDetector; } });
Object.defineProperty(exports, "CronMissedDetector", { enumerable: true, get: function () { return detectors_1.CronMissedDetector; } });
Object.defineProperty(exports, "AnomalyDetector", { enumerable: true, get: function () { return detectors_1.AnomalyDetector; } });
var notifiers_1 = require("./notifiers");
Object.defineProperty(exports, "ConsoleNotifier", { enumerable: true, get: function () { return notifiers_1.ConsoleNotifier; } });
Object.defineProperty(exports, "WeChatNotifier", { enumerable: true, get: function () { return notifiers_1.WeChatNotifier; } });
Object.defineProperty(exports, "TelegramNotifier", { enumerable: true, get: function () { return notifiers_1.TelegramNotifier; } });
Object.defineProperty(exports, "EmailNotifier", { enumerable: true, get: function () { return notifiers_1.EmailNotifier; } });
//# sourceMappingURL=index.js.map
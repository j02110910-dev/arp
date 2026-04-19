/**
 * SilentWatch - Agent Silent Failure Detector
 * Configuration management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Debug mode flag
export const isDebug = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

/**
 * Debug logging helper
 */
export function debugLog(message: string, ...args: unknown[]): void {
  if (isDebug) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

export interface DetectorConfig {
  /** Maximum consecutive calls to same tool before triggering alert */
  maxConsecutiveCalls?: number;
  /** Maximum consecutive empty responses before triggering alert */
  maxConsecutiveEmpty?: number;
  /** Timeout for single step in milliseconds */
  stepTimeoutMs?: number;
  /** Number of recent events to include in alert context */
  contextSnapshotSize?: number;
}

export interface NotifierConfig {
  /** Enable WeChat (Server酱) notifications */
  wechat?: {
    enabled: boolean;
    server酱Key?: string;
  };
  /** Enable Telegram notifications */
  telegram?: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
  };
  /** Enable Email notifications */
  email?: {
    enabled: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    toEmail?: string;
    fromEmail?: string;
  };
  /** Enable console/log output */
  console?: {
    enabled: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface SilentWatchConfig {
  /** Enable/disable entire monitor */
  enabled: boolean;
  /** Detect loops (same tool called repeatedly) */
  detectLoops: boolean;
  /** Detect empty/silent responses */
  detectEmptyResponses: boolean;
  /** Detect timeouts on individual steps */
  detectTimeouts: boolean;
  /** Detect missing scheduled tasks */
  detectCronMisses: boolean;
  /** Detect anomalous behavior patterns */
  detectAnomalies: boolean;
  /** Per-detector configuration */
  detectors: DetectorConfig;
  /** Notification channels */
  notifiers: NotifierConfig;
  /** Path to store alert history */
  alertHistoryPath?: string;
  /** Callback when alert is triggered (alternative to notifiers) */
  onAlert?: (alert: Alert) => void;
  /** HTTP API authentication key (optional, for security) */
  apiKey?: string;
  /** HTTP server configuration */
  server?: {
    /** Enable API authentication */
    requireAuth?: boolean;
  };
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  context: AlertContext;
  timestamp: Date;
  acknowledged: boolean;
}

export interface AlertContext {
  recentEvents: MonitoringEvent[];
  triggerCondition: string;
  suggestedFix?: string;
}

export interface MonitoringEvent {
  timestamp: Date;
  type: EventType;
  tool?: string;
  model?: string;
  duration?: number;
  responseLength?: number;
  content?: string;
  metadata?: Record<string, unknown>;
}

export type AlertType =
  | 'loop_detected'
  | 'empty_response'
  | 'timeout'
  | 'cron_missed'
  | 'anomaly';

export type EventType =
  | 'tool_call'
  | 'empty_response'
  | 'timeout'
  | 'cron_trigger'
  | 'cron_miss'
  | 'anomalous_pattern'
  | 'normal';

const DEFAULT_CONFIG: SilentWatchConfig = {
  enabled: true,
  detectLoops: true,
  detectEmptyResponses: true,
  detectTimeouts: true,
  detectCronMisses: true,
  detectAnomalies: true,
  detectors: {
    maxConsecutiveCalls: 10,
    maxConsecutiveEmpty: 3,
    stepTimeoutMs: 60000, // 60 seconds default
    contextSnapshotSize: 10,
  },
  notifiers: {
    console: {
      enabled: true,
      level: 'info',
    },
    wechat: {
      enabled: false,
    },
    telegram: {
      enabled: false,
    },
    email: {
      enabled: false,
    },
  },
  alertHistoryPath: './alert-history.json',
  server: {
    requireAuth: false,
  },
};

/**
 * Validate configuration values
 */
function validateConfig(config: SilentWatchConfig): void {
  // Validate detector settings
  if (config.detectors.maxConsecutiveCalls !== undefined) {
    if (config.detectors.maxConsecutiveCalls < 1) {
      console.warn('[Config] maxConsecutiveCalls must be at least 1, using default');
      config.detectors.maxConsecutiveCalls = DEFAULT_CONFIG.detectors.maxConsecutiveCalls!;
    }
    if (config.detectors.maxConsecutiveCalls > 100) {
      console.warn('[Config] maxConsecutiveCalls is unusually high (>100)');
    }
  }

  if (config.detectors.maxConsecutiveEmpty !== undefined) {
    if (config.detectors.maxConsecutiveEmpty < 1) {
      console.warn('[Config] maxConsecutiveEmpty must be at least 1, using default');
      config.detectors.maxConsecutiveEmpty = DEFAULT_CONFIG.detectors.maxConsecutiveEmpty!;
    }
  }

  if (config.detectors.stepTimeoutMs !== undefined) {
    if (config.detectors.stepTimeoutMs < 1000) {
      console.warn('[Config] stepTimeoutMs is too low (<1s), using default');
      config.detectors.stepTimeoutMs = DEFAULT_CONFIG.detectors.stepTimeoutMs!;
    }
    if (config.detectors.stepTimeoutMs > 3600000) {
      console.warn('[Config] stepTimeoutMs is very high (>1 hour)');
    }
  }

  if (config.detectors.contextSnapshotSize !== undefined) {
    if (config.detectors.contextSnapshotSize < 1) {
      console.warn('[Config] contextSnapshotSize must be at least 1, using default');
      config.detectors.contextSnapshotSize = DEFAULT_CONFIG.detectors.contextSnapshotSize!;
    }
  }

  // Validate notifier settings
  if (config.notifiers.wechat?.enabled && !config.notifiers.wechat.server酱Key) {
    console.warn('[Config] WeChat notifier enabled but no server酱Key provided');
    config.notifiers.wechat.enabled = false;
  }

  if (config.notifiers.telegram?.enabled) {
    if (!config.notifiers.telegram.botToken || !config.notifiers.telegram.chatId) {
      console.warn('[Config] Telegram notifier enabled but botToken or chatId missing');
      config.notifiers.telegram.enabled = false;
    }
  }

  if (config.notifiers.email?.enabled) {
    if (!config.notifiers.email.smtpHost || !config.notifiers.email.smtpUser || !config.notifiers.email.toEmail) {
      console.warn('[Config] Email notifier enabled but required fields (smtpHost, smtpUser, toEmail) missing');
      config.notifiers.email.enabled = false;
    }
    if (config.notifiers.email.smtpPort && (config.notifiers.email.smtpPort < 1 || config.notifiers.email.smtpPort > 65535)) {
      console.warn('[Config] Invalid smtpPort, using default (587)');
      config.notifiers.email.smtpPort = 587;
    }
  }
}

/**
 * Load configuration from environment and optionally from a config file
 */
export function loadConfig(configPath?: string): SilentWatchConfig {
  // Start with defaults
  const config: SilentWatchConfig = { ...DEFAULT_CONFIG };

  // Override with environment variables
  if (process.env.SILENT_WATCH_ENABLED === 'false') {
    config.enabled = false;
  }

  // Detector settings from env
  if (process.env.SILENT_WATCH_MAX_CONSECUTIVE_CALLS) {
    config.detectors.maxConsecutiveCalls = parseInt(
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_CALLS,
      10
    );
  }
  if (process.env.SILENT_WATCH_MAX_CONSECUTIVE_EMPTY) {
    config.detectors.maxConsecutiveEmpty = parseInt(
      process.env.SILENT_WATCH_MAX_CONSECUTIVE_EMPTY,
      10
    );
  }
  if (process.env.SILENT_WATCH_STEP_TIMEOUT_MS) {
    config.detectors.stepTimeoutMs = parseInt(
      process.env.SILENT_WATCH_STEP_TIMEOUT_MS,
      10
    );
  }
  if (process.env.SILENT_WATCH_CONTEXT_SIZE) {
    config.detectors.contextSnapshotSize = parseInt(
      process.env.SILENT_WATCH_CONTEXT_SIZE,
      10
    );
  }

  // WeChat config from env
  if (process.env.SERVER_CHAN_KEY) {
    config.notifiers.wechat = {
      enabled: true,
      server酱Key: process.env.SERVER_CHAN_KEY,
    };
  }

  // Telegram config from env
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    config.notifiers.telegram = {
      enabled: true,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    };
  }

  // Email config from env
  if (process.env.SMTP_HOST) {
    config.notifiers.email = {
      enabled: true,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      toEmail: process.env.TO_EMAIL,
      fromEmail: process.env.FROM_EMAIL || process.env.SMTP_USER,
    };
  }

  // API key from env
  if (process.env.SILENT_WATCH_API_KEY) {
    config.apiKey = process.env.SILENT_WATCH_API_KEY;
  }

  // Server auth requirement from env
  if (process.env.SILENT_WATCH_REQUIRE_AUTH) {
    config.server = {
      requireAuth: process.env.SILENT_WATCH_REQUIRE_AUTH === 'true',
    };
  }

  // Load from config file if provided
  if (configPath && fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // Deep merge file config
      Object.assign(config, fileConfig);
    } catch (error) {
      console.error('[Config] Failed to parse config file:', configPath, error);
      console.error('[Config] Using default configuration');
    }
  }

  // Validate final configuration
  validateConfig(config);

  return config;
}

/**
 * Get default config file path
 */
export function getDefaultConfigPath(): string {
  return path.join(process.cwd(), 'silent-watch.config.json');
}

export { DEFAULT_CONFIG };

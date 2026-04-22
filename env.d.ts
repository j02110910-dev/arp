/**
 * 环境变量类型定义 (Environment Variable Type Definitions)
 * 所有插件共享的环境变量统一在此声明
 */

/**
 * 插件开关 (Plugin Feature Flags)
 */
interface PluginFlags {
  SILENT_WATCH_ENABLED: string;
  COGNITIVE_GOVERNOR_ENABLED: string;
  PERMISSION_SENTINEL_ENABLED: string;
  OUTPUT_VERIFIER_ENABLED: string;
  STRESS_TESTER_ENABLED: string;
}

/**
 * 通知渠道配置 (Notification Channel Configuration)
 */
interface NotificationChannels {
  /** 企业微信/Server酱 WebHook 地址 */
  SERVER_CHAN_KEY: string;
  /** Server酱 SendKey (旧版，兼容) */
  SERVERCHAN_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  SLACK_WEBHOOK: string;
  FEISHU_WEBHOOK: string;
}

/**
 * AI/视觉 API 配置 (AI & Vision API Configuration)
 */
interface AIAPIConfig {
  VISION_API_KEY: string;
}

/**
 * 邮件/SMTP 配置 (Email/SMTP Configuration)
 */
interface EmailConfig {
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  FROM_EMAIL: string;
  TO_EMAIL: string;
}

/**
 * 运行时环境 (Runtime Environment)
 */
interface RuntimeEnv {
  NODE_ENV: string;
  DEBUG: string;
}

/**
 * 静默监控插件详细配置 (SilentWatch Detailed Configuration)
 */
interface SilentWatchConfig {
  SILENT_WATCH_ENABLED: string;
  SILENT_WATCH_MAX_CONSECUTIVE_CALLS: string;
  SILENT_WATCH_MAX_CONSECUTIVE_EMPTY: string;
  SILENT_WATCH_STEP_TIMEOUT_MS: string;
  SILENT_WATCH_CONTEXT_SIZE: string;
  SILENT_WATCH_API_KEY: string;
  SILENT_WATCH_REQUIRE_AUTH: string;
}

/**
 * 认知治理插件详细配置 (CognitiveGovernor Detailed Configuration)
 */
interface CognitiveGovernorEnv {
  COGNITIVE_GOVERNOR_ENABLED: string;
  COGNITIVE_GOVERNOR_TOKEN_LIMIT: string;
  COGNITIVE_GOVERNOR_THRESHOLD: string;
  COGNITIVE_GOVERNOR_STRATEGY: string;
}

/**
 * 压力测试插件详细配置 (Agent Stress Tester Detailed Configuration)
 */
interface StressTesterEnv {
  STRESS_TESTER_ENABLED: string;
  TARGET_AGENT: string;
  TEST_TIMEOUT: string;
  MAX_CONCURRENT: string;
  TEST_SUITES: string;
  DRIFT_THRESHOLD: string;
  LOAD_PROFILES: string;
}

/**
 * 输出验证器详细配置 (Output Verifier Detailed Configuration)
 */
interface OutputVerifierEnv {
  OUTPUT_VERIFIER_ENABLED: string;
  OUTPUT_VERIFIER_STRICTNESS: string;
  OUTPUT_VERIFIER_REPORT_PATH: string;
  OUTPUT_VERIFIER_API_URL: string;
  OUTPUT_VERIFIER_API_KEY: string;
  OUTPUT_VERIFIER_VISION_API_KEY: string;
}

/**
 * 所有环境变量的联合类型
 */
type AllEnvVars = PluginFlags &
  NotificationChannels &
  AIAPIConfig &
  EmailConfig &
  RuntimeEnv &
  SilentWatchConfig &
  CognitiveGovernorEnv &
  StressTesterEnv &
  OutputVerifierEnv;

/**
 * Node.js process.env 类型扩展
 */
declare namespace NodeJS {
  interface ProcessEnv extends AllEnvVars {}
}

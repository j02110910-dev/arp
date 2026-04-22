/**
 * Structured Logging Module
 * Provides JSON-formatted structured logging with timestamp, level, message, and context
 * Uses pino for high-performance structured logging
 */

import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component?: string;
  message: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Create a structured logger instance
 * @param component - The component name for log entries (e.g., 'cli', 'dashboard', 'feishu-notifier')
 * @param minLevel - Minimum log level (default: 'info')
 * @returns Logger instance with debug, info, warn, error methods
 */
export function createLogger(component: string, minLevel: LogLevel = 'info'): Logger {
  const pinoLogger = pino({
    level: process.env.LOG_LEVEL || minLevel,
    base: {
      component,
      pid: process.pid,
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
  });

  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      pinoLogger.debug(context ?? {}, message),
    info: (message: string, context?: Record<string, unknown>) =>
      pinoLogger.info(context ?? {}, message),
    warn: (message: string, context?: Record<string, unknown>) =>
      pinoLogger.warn(context ?? {}, message),
    error: (message: string, context?: Record<string, unknown>) =>
      pinoLogger.error(context ?? {}, message),
  };
}

// Export a default logger for general use in src/
export const defaultLogger = createLogger('arp');

// Export factory for creating child loggers with additional context
export function createChildLogger(context: Record<string, unknown>): Logger {
  return {
    debug: (message: string, ctx?: Record<string, unknown>) =>
      defaultLogger.debug(message, { ...context, ...ctx }),
    info: (message: string, ctx?: Record<string, unknown>) =>
      defaultLogger.info(message, { ...context, ...ctx }),
    warn: (message: string, ctx?: Record<string, unknown>) =>
      defaultLogger.warn(message, { ...context, ...ctx }),
    error: (message: string, ctx?: Record<string, unknown>) =>
      defaultLogger.error(message, { ...context, ...ctx }),
  };
}

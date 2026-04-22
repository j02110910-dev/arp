/**
 * Structured Logging Module
 * Uses pino for JSON logging to stderr
 */

import pino from 'pino';

export interface Logger {
  info: (message: string, metadata?: Record<string, unknown>) => void;
  warn: (message: string, metadata?: Record<string, unknown>) => void;
  error: (message: string, metadata?: Record<string, unknown>) => void;
  debug?: (message: string, metadata?: Record<string, unknown>) => void;
}

export interface LoggerModule {
  plugin?: string;
  detector?: string;
}

/**
 * Create a structured logger for a specific module
 * @param module - Object containing plugin and/or detector name
 * @returns Logger instance with info, warn, error methods
 */
export function createLogger(module: LoggerModule = {}): Logger {
  const baseLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
    // Output JSON to stderr
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    base: {
      plugin: 'silent-watch',
      detector: module.detector,
    },
  }, pino.destination(2));

  return {
    info(message: string, metadata?: Record<string, unknown>) {
      baseLogger.info({ ...module, metadata }, message);
    },
    warn(message: string, metadata?: Record<string, unknown>) {
      baseLogger.warn({ ...module, metadata }, message);
    },
    error(message: string, metadata?: Record<string, unknown>) {
      baseLogger.error({ ...module, metadata }, message);
    },
    debug(message: string, metadata?: Record<string, unknown>) {
      baseLogger.debug({ ...module, metadata }, message);
    },
  };
}

// Export a default logger for general use
export const defaultLogger = createLogger({ plugin: 'silent-watch' });

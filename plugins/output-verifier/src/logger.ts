/**
 * Structured Logger for Output Verifier using Pino
 * Supports structured JSON logging for queryable logs
 */

import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function createLogger(component: string, minLevel: LogLevel = 'info'): Logger {
  const pinoLogger = pino({
    level: minLevel,
    base: {
      component,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  });

  return {
    debug: (message: string, context?: Record<string, unknown>) => pinoLogger.debug(context, message),
    info: (message: string, context?: Record<string, unknown>) => pinoLogger.info(context, message),
    warn: (message: string, context?: Record<string, unknown>) => pinoLogger.warn(context, message),
    error: (message: string, context?: Record<string, unknown>) => pinoLogger.error(context, message),
  };
}

// Export a singleton logger instance with component='output-verifier'
export const logger = createLogger('output-verifier');

// Export factory for creating child loggers with additional context
export function createChildLogger(context: Record<string, unknown>): Logger {
  return {
    debug: (message: string, ctx?: Record<string, unknown>) => logger.debug(message, { ...context, ...ctx }),
    info: (message: string, ctx?: Record<string, unknown>) => logger.info(message, { ...context, ...ctx }),
    warn: (message: string, ctx?: Record<string, unknown>) => logger.warn(message, { ...context, ...ctx }),
    error: (message: string, ctx?: Record<string, unknown>) => logger.error(message, { ...context, ...ctx }),
  };
}

import pino from 'pino';

export interface CognitiveLogger {
  info: (msg: string, context?: Record<string, unknown>) => void;
  warn: (msg: string, context?: Record<string, unknown>) => void;
  error: (msg: string, context?: Record<string, unknown>) => void;
  debug: (msg: string, context?: Record<string, unknown>) => void;
  tokenUsage: (tokens: number, context?: Record<string, unknown>) => void;
  truncationCount: (context?: Record<string, unknown>) => void;
  cacheHitRate: (rate: number, context?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => CognitiveLogger;
}

const createBaseLogger = () =>
  pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
      component: 'cognitive-governor',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

const baseLogger = createBaseLogger();

export const logger: CognitiveLogger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    baseLogger.info({ message: msg, ...ctx }),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    baseLogger.warn({ message: msg, ...ctx }),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    baseLogger.error({ message: msg, ...ctx }),
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    baseLogger.debug({ message: msg, ...ctx }),
  tokenUsage: (tokens: number, ctx?: Record<string, unknown>) =>
    baseLogger.info({
      message: 'Token usage',
      metric: 'token_usage',
      value: tokens,
      ...ctx,
    }),
  truncationCount: (ctx?: Record<string, unknown>) =>
    baseLogger.info({
      message: 'Truncation triggered',
      metric: 'truncation_count',
      ...ctx,
    }),
  cacheHitRate: (rate: number, ctx?: Record<string, unknown>) =>
    baseLogger.info({
      message: 'Cache hit rate',
      metric: 'cache_hit_rate',
      value: rate,
      ...ctx,
    }),
  child: (bindings: Record<string, unknown>): CognitiveLogger => {
    const child = baseLogger.child(bindings);
    return {
      info: (msg: string, ctx?: Record<string, unknown>) =>
        child.info({ message: msg, ...ctx }),
      warn: (msg: string, ctx?: Record<string, unknown>) =>
        child.warn({ message: msg, ...ctx }),
      error: (msg: string, ctx?: Record<string, unknown>) =>
        child.error({ message: msg, ...ctx }),
      debug: (msg: string, ctx?: Record<string, unknown>) =>
        child.debug({ message: msg, ...ctx }),
      tokenUsage: (tokens: number, ctx?: Record<string, unknown>) =>
        child.info({ message: 'Token usage', metric: 'token_usage', value: tokens, ...ctx }),
      truncationCount: (ctx?: Record<string, unknown>) =>
        child.info({ message: 'Truncation triggered', metric: 'truncation_count', ...ctx }),
      cacheHitRate: (rate: number, ctx?: Record<string, unknown>) =>
        child.info({ message: 'Cache hit rate', metric: 'cache_hit_rate', value: rate, ...ctx }),
      child: (b: Record<string, unknown>) => logger.child({ ...bindings, ...b }),
    };
  },
};

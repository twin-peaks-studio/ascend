/**
 * Structured Logger
 *
 * Enterprise-scale logging with context, levels, and environment awareness.
 * Integrates with Vercel logs automatically.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User logged in', { userId: user.id });
 *   logger.error('Payment failed', { error, userId, amount });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogData {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  /**
   * Debug logs (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return;
    this.log('debug', message, context);
  }

  /**
   * Info logs (general information)
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Warning logs
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Error logs (sent to monitoring in production)
   */
  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
    // TODO: Integrate with Sentry after Phase 0 #5
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Check log level threshold
    if (this.shouldSkipLog(level)) return;

    const timestamp = new Date().toISOString();
    const logData: LogData = {
      level,
      message,
      timestamp,
      ...context,
      // TODO: Auto-inject requestId after implementing AsyncLocalStorage
    };

    // Production: Structured JSON for parsing
    if (!this.isDevelopment) {
       
      console.log(JSON.stringify(logData));
      return;
    }

    // Development: Pretty console with emojis
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[level];

    const consoleMethod = level === 'debug' ? 'log' : level;

     
    console[consoleMethod](
      `${emoji} [${level.toUpperCase()}] ${message}`,
      context ? JSON.stringify(context, null, 2) : ''
    );
  }

  /**
   * Check if log should be skipped based on level
   */
  private shouldSkipLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex < currentLevelIndex;
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Type-safe log context builders
 */
export const logContext = {
  user: (userId: string) => ({ userId }),
  error: (error: Error | unknown) => ({
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }),
  http: (status: number, method: string, path: string) => ({
    httpStatus: status,
    httpMethod: method,
    httpPath: path,
  }),
  timing: (durationMs: number) => ({ durationMs }),
};

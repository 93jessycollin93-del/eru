/**
 * Logger utility for centralized error & warning logging.
 * Respects DEV/PROD environment and can integrate with error tracking services.
 *
 * Usage:
 *   logger.error('Something failed', { context: 'data' });
 *   logger.warn('This is deprecated');
 *   logger.info('User action', { userId: '123' });
 *
 * Fixes: Replaces silent .catch(() => {}) and console.error calls.
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Log an error. In production, integrates with error tracking (e.g., Sentry).
   */
  error: (message, context = {}) => {
    const logEntry = {
      level: 'error',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (isDev) {
      console.error(`[ERU Error] ${message}`, context);
    } else {
      // In production, could send to Sentry, LogRocket, etc.
      // sentryClient.captureException(new Error(message), { extra: context });
      console.error(`[ERU Error] ${message}`, context);
    }

    return logEntry;
  },

  /**
   * Log a warning.
   */
  warn: (message, context = {}) => {
    const logEntry = {
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (isDev) {
      console.warn(`[ERU Warn] ${message}`, context);
    }

    return logEntry;
  },

  /**
   * Log informational message.
   */
  info: (message, context = {}) => {
    if (isDev) {
      console.info(`[ERU Info] ${message}`, context);
    }
  },

  /**
   * Safe async error handler for promises.
   * Usage: somePromise.catch(logger.handleAsyncError('operation name'))
   */
  handleAsyncError: (operationName) => (error) => {
    logger.error(`Async operation failed: ${operationName}`, {
      error: error?.message || error?.toString(),
      stack: error?.stack,
    });
    return null;
  },
};

export default logger;

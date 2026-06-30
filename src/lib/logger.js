/**
 * Lightweight logger that respects the build environment.
 *
 * - In development, forwards everything to console.
 * - In production, suppresses debug/log/info to keep the browser console clean,
 *   but still emits warnings and errors so they can be captured by monitoring
 *   tools (e.g., Sentry) later.
 *
 * Use this instead of calling `console.*` directly throughout the codebase.
 */

const isDev = import.meta.env?.DEV ?? false;

const noop = () => {};

export const logger = {
  debug: isDev ? console.debug.bind(console) : noop,
  log: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export default logger;

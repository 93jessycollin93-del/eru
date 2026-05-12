/**
 * Legacy translation primitive kept as a no-op fallback.
 * Returns the provided fallback when present, otherwise the key itself.
 */
export default function T({ k, fallback }) {
  return fallback || k;
}
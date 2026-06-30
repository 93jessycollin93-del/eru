import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client. Sensible defaults:
 *
 * - `refetchOnWindowFocus: false` — we don't want the UI to thrash when the
 *   user tabs back in.
 * - `retry: 1` — one retry is enough for transient network blips; more just
 *   delays surfacing real failures.
 * - `staleTime: 5 minutes` — prevents the same query from refetching on every
 *   mount across sibling components. Override per-query where fresher data is
 *   required.
 * - `gcTime: 10 minutes` — how long unused query data lingers in cache before
 *   it gets garbage collected (was `cacheTime` in v4).
 */
export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		},
	},
});

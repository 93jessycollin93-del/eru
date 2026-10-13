import { useRef } from 'react';
import { useOutlet, useLocation } from 'react-router-dom';

// Primary tab paths whose internal state (scroll, sub-views, form drafts)
// should survive navigation away and back. Other pages remount normally.
const KEEP_ALIVE_PATHS = new Set([
  '/', '/dashboard', '/markets', '/ailab', '/arena',
  '/jackie', '/portfolio', '/bot-farm', '/command',
]);

/**
 * KeepAliveOutlet — caches the outlet elements for primary tab paths so
 * their component instances (and therefore their useState/useRef state)
 * stay mounted when the user navigates away. Hidden pages use display:none
 * so they don't affect layout; when the user returns, the cached instance
 * is shown again with its state intact.
 *
 * Non-keep-alive pages render normally (remount on each navigation).
 */
export default function KeepAliveOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const cacheRef = useRef({});

  const isKeepAlive = KEEP_ALIVE_PATHS.has(location.pathname);

  // Cache the outlet element during render so the component instance stays
  // mounted (just hidden) when the user navigates to a different tab.
  if (isKeepAlive) {
    cacheRef.current[location.pathname] = outlet;
  }

  return (
    <>
      {Object.entries(cacheRef.current).map(([path, cached]) => (
        <div
          key={path}
          style={{ display: path === location.pathname ? 'block' : 'none' }}
        >
          {cached}
        </div>
      ))}
      {!isKeepAlive && (
        <div key={location.pathname}>{outlet}</div>
      )}
    </>
  );
}
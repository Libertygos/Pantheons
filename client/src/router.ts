/**
 * Minimal history router — two routes ('/' and '/room/:code'), no dependency. The live
 * socket crosses navigations via the active-room baton, not the router.
 */
import { useEffect, useState } from 'react';

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function roomCodeFromPath(path: string): string | null {
  const m = /^\/room\/([A-Za-z0-9]+)$/.exec(path);
  return m ? m[1]!.toUpperCase() : null;
}

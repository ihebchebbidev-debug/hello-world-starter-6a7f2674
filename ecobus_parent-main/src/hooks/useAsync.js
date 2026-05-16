import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAsync — load data with loading / error / retry state.
 *
 * Cancels stale updates on unmount or when deps change mid-flight.
 *
 * Important UX detail: on `reload()` we DO NOT flash `loading=true` if we
 * already have data. That keeps pull-to-refresh from blanking the list
 * for a frame, which feels janky on every screen that uses this hook.
 * Consumers that care about a refresh-spinner should use the dedicated
 * `refreshing` flag.
 */
export default function useAsync(fn, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
  });
  const requestId = useRef(0);
  const hasDataRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({
      ...s,
      // Only show full-page loader on the very first load.
      loading: !hasDataRef.current,
      refreshing: hasDataRef.current,
      error: null,
    }));
    try {
      const data = await fn();
      if (id !== requestId.current) return;
      hasDataRef.current = true;
      setState({ data, loading: false, refreshing: false, error: null });
    } catch (error) {
      if (id !== requestId.current) return;
      // Keep prior data on reload errors — better UX than a blank screen.
      setState((s) => ({
        data: hasDataRef.current ? s.data : null,
        loading: false,
        refreshing: false,
        error,
      }));
    }
  }, deps);

  useEffect(() => {
    run();
    return () => { requestId.current += 1; }; // invalidate any in-flight request
  }, [run]);

  return { ...state, reload: run };
}

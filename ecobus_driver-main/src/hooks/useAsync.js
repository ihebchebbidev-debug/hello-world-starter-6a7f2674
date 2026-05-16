import { useCallback, useEffect, useRef, useState } from 'react';

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
    return () => { requestId.current += 1; };
  }, [run]);

  return { ...state, reload: run };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

interface QueryState<T> {
  data: T | undefined;
  error: ApiError | Error | null;
  loading: boolean;
  refetch: () => void;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Minimal data-fetching hook: loading / error / empty states, refetch,
 * abort on unmount, and re-run when `deps` change.
 */
export function useQuery<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fnRef
      .current(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setDataState(res);
      })
      .catch((err) => {
        if (!controller.signal.aborted && err.name !== 'AbortError') setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => (typeof updater === 'function' ? (updater as (p: T | undefined) => T)(prev) : updater));
  }, []);

  return { data, error, loading, refetch, setData };
}

/** Imperative async action with pending / error state (for form submits). */
export function useMutation<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn; // always call the latest closure (fresh form state)

  const mutate = useCallback(async (...args: TArgs): Promise<TResult> => {
    setLoading(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error, setError };
}

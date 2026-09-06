import { useCallback, useEffect, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic hook to run a Supabase query function on mount and expose
 * loading / error / data / refetch. `deps` re-triggers the fetch.
 */
export function useSupabaseQuery<T>(
  queryFn: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  deps: React.DependencyList = []
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    queryFn().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setData(null);
      } else {
        setData(data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    const cancel = run();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}

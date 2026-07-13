import { useCallback, useEffect, useState } from "react";

export interface ApiResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

export function useApiResource<T>(
  load: () => Promise<T>,
  options: Readonly<{ clearOnError?: boolean }> = {},
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void load().then(
      (next) => {
        if (!active) return;
        setData(next);
        setLoading(false);
      },
      (reason: unknown) => {
        if (!active) return;
        if (options.clearOnError) setData(null);
        setError(reason instanceof Error ? reason : new Error("REQUEST_FAILED"));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, load, options.clearOnError]);

  return { data, error, loading, reload };
}

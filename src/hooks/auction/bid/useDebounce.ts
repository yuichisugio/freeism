import { useEffect, useState } from "react";

/**
 * デバンスした値を返す
 * @param value 値
 * @param delay 遅延時間
 * @returns デバンスした値
 */
export function useDebounce<T>(value: T, delay: number): T {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  // デバンスした値
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 遅延時間が経過したら、デバンスした値を更新
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return debouncedValue;
}

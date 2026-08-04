"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * State persisted to localStorage.
 *
 * SSR-safe: the first render always uses `defaultValue` so server and client
 * markup match, then the stored value is adopted in an effect after mount.
 */
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) setValue(parsed);
    } catch {
      // Corrupt or unavailable storage: keep the default.
    }
    // `isValid` is expected to be a stable module-level predicate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full or blocked: in-memory state still updates.
      }
    },
    [key],
  );

  return [value, update];
}

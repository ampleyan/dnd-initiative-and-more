import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

/**
 * Like useState, but persists to localStorage under `key`.
 * Values are JSON-encoded; parse failures fall back to `defaultValue`.
 * Updates are written synchronously after render via useEffect, so two
 * setStates in the same tick coalesce into a single write.
 */
export function useLocalState<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  });

  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

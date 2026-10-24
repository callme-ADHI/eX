import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, storageSubscribe } from '../../shared/storage';

/**
 * Reactive hook over chrome.storage.local.
 * Reads on mount, subscribes to changes, returns [value, setter].
 */
export function useStorage<T>(key: string, defaultVal: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(defaultVal);

  useEffect(() => {
    // Initial read
    storageGet<T>(key).then((v) => {
      if (v !== undefined) setValue(v);
    });
    // Subscribe to future changes
    const unsub = storageSubscribe<T>(key, (newVal) => {
      setValue(newVal);
    });
    return unsub;
  }, [key]);

  const setter = useCallback(
    (v: T) => {
      setValue(v);
      storageSet(key, v);
    },
    [key]
  );

  return [value, setter];
}

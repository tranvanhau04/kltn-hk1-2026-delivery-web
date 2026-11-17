import { useState, useEffect } from 'react';

/**
 * useDebounce hook
 * Delays updating the debounced value until after `delay` milliseconds
 * have elapsed since the last time the value changed.
 */
export function useDebounce<T>(value: T, delay: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

import { useEffect, useState } from "react";

export const BOOKING_SEARCH_DEBOUNCE_MS = 300;

export const useDebouncedValue = <T>(
  value: T,
  delay = BOOKING_SEARCH_DEBOUNCE_MS,
): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

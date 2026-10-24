// components/products/hooks/useDebouncedValue.ts
import { useEffect, useState } from "react";

// For <input type="date"> filters. Typing a year emits a valid date per digit
// (0002, 0020, 0202, 2026...), and each one would otherwise be a request.
export const DATE_INPUT_DEBOUNCE_MS = 400;

export function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);

  return debounced;
}

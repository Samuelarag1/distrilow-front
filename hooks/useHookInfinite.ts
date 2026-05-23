// hooks/useInfiniteScroll.ts
"use client";

import { useEffect, useRef } from "react";

export function useInfiniteScroll(opts: {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
  const { enabled, onLoadMore, rootMargin = "800px" } = opts;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root: null, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [enabled, onLoadMore, rootMargin]);

  return ref;
}

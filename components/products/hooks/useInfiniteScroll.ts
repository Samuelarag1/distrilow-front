// components/products/hooks/useInfiniteScroll.ts
import { useEffect, useState } from "react";

export function useInfiniteScroll(opts: {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
  const { enabled, onLoadMore, rootMargin = "900px" } = opts;
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root: null, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [enabled, onLoadMore, rootMargin, el]);

  return setEl;
}

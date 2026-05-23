// components/products/hooks/useInfiniteScroll.ts
import { useEffect, useRef, useState } from "react";

export function useInfiniteScroll(opts: {
  enabled: boolean;
  onLoadMore: () => Promise<unknown> | void;
  rootMargin?: string;
}) {
  const { enabled, onLoadMore, rootMargin = "900px" } = opts;
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      loadingRef.current = false;
      return;
    }

    if (!el) return;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadingRef.current) return;

        loadingRef.current = true;
        io.unobserve(entry.target);
        Promise.resolve(onLoadMore()).finally(() => {
          resumeTimer = setTimeout(() => {
            loadingRef.current = false;
            if (el) io.observe(el);
          }, 180);
        });
      },
      { root: null, rootMargin }
    );

    io.observe(el);
    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      io.disconnect();
    };
  }, [enabled, onLoadMore, rootMargin, el]);

  return setEl;
}

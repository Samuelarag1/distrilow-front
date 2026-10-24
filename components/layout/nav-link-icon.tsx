"use client";

import { useLinkStatus } from "next/link";
import type { ComponentType } from "react";
import { BrandSpinner } from "@/components/common/brand-spinner";
import { cn } from "@/lib/utils";

/**
 * A sidebar link's icon. While the router is really navigating to that link
 * (useLinkStatus: Next's own pending state, no timers), the icon turns into
 * the app's spinner. Both change after 150ms, so an instant navigation (a
 * prefetched route) shows nothing at all. Must be rendered inside the <Link>.
 */
export function NavLinkIcon({
  icon: Icon,
}: {
  icon: ComponentType<{ className?: string }>;
}) {
  const { pending } = useLinkStatus();

  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-[opacity,transform] group-hover:scale-110",
          pending && "opacity-0 delay-150"
        )}
      />
      {pending && (
        <BrandSpinner
          size="sm"
          className="absolute inset-0 m-auto animate-in fade-in-0 delay-150 fill-mode-both"
        />
      )}
    </span>
  );
}

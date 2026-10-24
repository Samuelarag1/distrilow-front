"use client";

import { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import { BrandSpinnerScreen } from "@/components/common/brand-spinner";

/**
 * While the router is navigating to the sidebar link this is rendered in
 * (useLinkStatus: Next's own pending state), the app's full-screen spinner —
 * the same one as the login and app/loading.tsx, with the same label, so the
 * hand-off to the route's loading screen reads as a single spinner.
 *
 * - Portal to <body>: the sidebar's backdrop-blur makes it the containing
 *   block of any fixed descendant, which would shrink the screen to the
 *   sidebar's box.
 * - z-[60]: above the mobile sidebar (a sheet at z-50). pointer-events-auto:
 *   while that sheet is open Radix sets `pointer-events: none` on <body>,
 *   and without it taps would go through the spinner to the hidden menu.
 * - Fades in after 150ms, so an instant navigation (a prefetched route)
 *   shows nothing at all.
 * - React events cross portals: without stopPropagation, a click on the
 *   screen would reach the <Link> and start the navigation again.
 *
 * Must be rendered inside the <Link>.
 */
export function NavPendingScreen() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return createPortal(
    <div onClick={(event) => event.stopPropagation()}>
      <BrandSpinnerScreen
        label="Cargando..."
        className="pointer-events-auto z-[60] animate-in fade-in-0 delay-150 fill-mode-both"
      />
    </div>,
    document.body
  );
}

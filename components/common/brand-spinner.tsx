"use client";

import Image from "next/image";
import { useId, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type BrandSpinnerSize = "sm" | "md" | "lg";
type BrandSpinnerLayout = "inline" | "stacked";

interface BrandSpinnerProps {
  className?: string;
  size?: BrandSpinnerSize;
  label?: string;
  layout?: BrandSpinnerLayout;
  labelClassName?: string;
}

// box: outer diameter; stroke: ring width; gap: space between ring and logo.
// The logo sits dead center with the same gap all around (symmetric).
const SIZES: Record<BrandSpinnerSize, { box: number; stroke: number; gap: number }> = {
  sm: { box: 18, stroke: 2, gap: 2 },
  md: { box: 44, stroke: 3, gap: 3 },
  lg: { box: 88, stroke: 3, gap: 5 },
};

// Must match the duration of .brand-spinner-ring in globals.css.
const SPIN_DURATION_MS = 1100;
// Share of the circle the arc covers; both ends are rounded.
const ARC_FRACTION = 0.68;
// The logo's star reaches almost to the image edge: leave the same margin all
// around it inside the disc.
const LOGO_SCALE = 0.94;

/**
 * The app's only loading indicator: the logo, still and centered, inside a
 * turning arc with rounded ends over a circular track. Every instance shares
 * the same rotation phase, so when one loading screen hands over to the next
 * (login → route loading → page) the arc keeps turning instead of jumping back
 * to the start.
 */
export function BrandSpinner({
  className,
  size = "md",
  label,
  layout = "stacked",
  labelClassName,
}: BrandSpinnerProps) {
  const ringRef = useRef<SVGSVGElement>(null);
  const gradientId = `brand-spinner-${useId().replace(/:/g, "")}`;
  const { box, stroke, gap } = SIZES[size];
  const logo = Math.round((box - 2 * (stroke + gap)) * LOGO_SCALE);
  const center = box / 2;
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useLayoutEffect(() => {
    if (!ringRef.current) return;
    ringRef.current.style.animationDelay = `-${Date.now() % SPIN_DURATION_MS}ms`;
  }, []);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        layout === "stacked" && "flex-col gap-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className="relative grid shrink-0 place-items-center"
        style={{ width: box, height: box }}
        aria-hidden="true"
      >
        <svg
          ref={ringRef}
          className="brand-spinner-ring absolute inset-0"
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          fill="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: "hsl(var(--brand-cyan))" }} />
              <stop offset="100%" style={{ stopColor: "hsl(var(--brand-pink))" }} />
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={stroke}
            style={{ stroke: "hsl(var(--border))" }}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * ARC_FRACTION} ${circumference}`}
            stroke={`url(#${gradientId})`}
          />
        </svg>
        <Image
          src="/logo.png"
          alt=""
          width={logo}
          height={logo}
          priority={size === "lg"}
          className="relative object-contain"
        />
      </div>
      {label ? (
        <span
          className={cn(
            "text-sm font-medium text-muted-foreground",
            size === "sm" && "text-xs",
            labelClassName
          )}
        >
          {label}
        </span>
      ) : (
        <span className="sr-only">Cargando</span>
      )}
    </div>
  );
}

/**
 * Full-screen loading state. Login, route loading (app/loading.tsx), the
 * session check and sidebar navigation all render exactly this, at the same
 * place, so a sequence of them reads as a single spinner. `className` is only
 * for stacking and entrance (see NavPendingScreen), never for the look.
 */
export function BrandSpinnerScreen({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "app-loader-screen fixed inset-0 z-40 grid place-items-center bg-background",
        className
      )}
    >
      <BrandSpinner size="lg" label={label} />
    </div>
  );
}

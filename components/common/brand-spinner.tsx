import Image from "next/image";

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

const spinnerSizeClass: Record<BrandSpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

export function BrandSpinner({
  className,
  size = "md",
  label,
  layout = "stacked",
  labelClassName,
}: BrandSpinnerProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 spinner-reveal",
        layout === "stacked" && "flex-col",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Cargando"}
    >
      <div className={cn("relative", spinnerSizeClass[size])}>
        <Image
          src="/logo.png"
          alt=""
          fill
          sizes="(max-width: 768px) 24px, 56px"
          className="animate-brand-spin rounded-full object-cover ring-1 ring-border/70"
          aria-hidden="true"
        />
      </div>
      {label ? (
        <span
          className={cn(
            "text-xs font-medium tracking-wide text-muted-foreground",
            labelClassName
          )}
        >
          {label}
        </span>
      ) : null}
      <span className="sr-only">{label ?? "Cargando"}</span>
    </div>
  );
}

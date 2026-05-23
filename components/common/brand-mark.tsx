import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandMarkProps {
  className?: string;
  priority?: boolean;
  alt?: string;
}

export function BrandMark({
  className,
  priority = false,
  alt = "Logo DistriLow",
}: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border/70",
        className
      )}
    >
      <Image
        src="/logo.png"
        alt={alt}
        fill
        sizes="(max-width: 768px) 40px, 48px"
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

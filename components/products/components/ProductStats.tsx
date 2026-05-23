// components/products/components/ProductsStats.tsx
import { Loader2 } from "lucide-react";

export function ProductsStats(props: {
  visible: boolean;
  count: number;
  total: number;
  isLoadingMore: boolean;
}) {
  if (!props.visible) return null;

  return (
    <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        {props.count.toLocaleString()} / {props.total.toLocaleString()}
      </span>

      {props.isLoadingMore && (
        <span className="inline-flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          cargando…
        </span>
      )}
    </div>
  );
}

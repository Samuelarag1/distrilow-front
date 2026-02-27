// components/products/components/ProductCard/ProductCardMeta.tsx
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/products";

export function ProductCardMeta({ product }: { product: Product }) {
  const stock = Number(product.stock ?? 0);
  const minStock = Number(product.minStock ?? 0);
  const unit = product.unit || "unidades";
  const stockTextClass = stock <= minStock ? "text-red-500" : "text-foreground";

  return (
    <div className="flex items-center justify-between pt-2 border-t mt-2">
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Envasado
        </span>
        <Badge
          variant="secondary"
          className="font-black text-[10px] py-0 px-2 mt-1"
        >
          {(product as any).measurementType || "U."}
        </Badge>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">
          Existencia
        </span>
        <div className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full border border-dashed">
          <span className={`text-xs font-black ${stockTextClass}`}>
            {stock}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

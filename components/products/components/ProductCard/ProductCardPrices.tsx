// components/products/components/ProductCard/ProductCardPrices.tsx
import { Product } from "@/lib/products";

export function ProductCardPrices({ product }: { product: Product }) {
  return (
    <div className="flex items-end justify-between pt-2">
      <div className="flex flex-col gap-1 w-full">
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Precios
        </span>

        <div className="flex items-center justify-between w-full border-b border-dashed pb-1">
          <span className="text-xs font-bold text-muted-foreground">
            Minorista
          </span>
          <span className="font-black text-sm text-foreground">
            ${Number((product as any).retailPrice ?? 0).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-bold text-muted-foreground">
            Mayorista
          </span>
          <span className="font-black text-sm text-foreground">
            ${Number(product.wholesalePrice ?? 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

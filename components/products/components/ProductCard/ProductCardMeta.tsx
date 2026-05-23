// components/products/components/ProductCard/ProductCardMeta.tsx
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/products";

export function ProductCardMeta({ product }: { product: Product }) {
  const stock = Number(product.stock ?? 0);
  const minStock = Number(product.minStock ?? 0);
  const unit = product.unit || "unidades";
  const stockTextClass = stock <= minStock ? "text-red-500" : "text-foreground";
  const productId = String(product.id ?? "").trim();
  const baseProductId = String(
    (product as any).stockBaseProductId ?? product.id ?? ""
  ).trim();
  const isSharedStock =
    product.trackStock !== false &&
    Boolean(productId && baseProductId && baseProductId !== productId);
  const stockModeLabel = isSharedStock ? "Stock compartido" : "Stock propio";
  const consumptionRaw = Number((product as any).stockConsumptionQuantity ?? 1);
  const consumption =
    Number.isFinite(consumptionRaw) && consumptionRaw > 0 ? consumptionRaw : 1;
  const stockBaseUnit = String(
    (product as any).stockBaseUnit ?? product.measurementType ?? "unit"
  );

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
        {product.trackStock !== false && (
          <>
            <Badge
              variant="outline"
              className="mt-1 w-fit text-[10px] py-0 px-2 font-semibold"
            >
              {stockModeLabel}
            </Badge>
            <span className="text-[10px] text-muted-foreground mt-1">
              Consume {consumption} {stockBaseUnit}/venta
            </span>
          </>
        )}
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

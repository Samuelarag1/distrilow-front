// components/products/components/ProductCard/ProductCardImage.tsx
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/products";

export function ProductCardImage({ product }: { product: Product }) {
  const imageSrc = product.brand || "/placeholder.svg";
  const stock = Number(product.stock ?? 0);
  const minStock = Number(product.minStock ?? 0);
  const isLowStock = stock <= minStock;
  const categoryLabel =
    typeof (product as any).category === "object" &&
    (product as any).category?.name
      ? (product as any).category.name
      : typeof (product as any).category === "string" &&
        (product as any).category.trim()
      ? (product as any).category
      : product.categoryId || "Sin categoria";

  return (
    <div className="aspect-video bg-muted relative overflow-hidden">
      <img
        src={imageSrc}
        alt={product.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 bg-muted"
      />

      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <Badge
          variant="secondary"
          className="backdrop-blur-md bg-white/70 dark:bg-black/70 border-none shadow-sm text-xs"
        >
          {categoryLabel}
        </Badge>
        {isLowStock && (
          <Badge className="bg-red-500 text-white border-none shadow-sm text-xs">
            Stock bajo
          </Badge>
        )}
      </div>
    </div>
  );
}

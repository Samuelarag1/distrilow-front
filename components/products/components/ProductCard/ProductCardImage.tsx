// components/products/components/ProductCard/ProductCardImage.tsx
import { Badge } from "@/components/ui/badge";
import { Category } from "@/lib/api-types";
import { Product } from "@/lib/products";
import { swrFetcher } from "@/lib/swr-fetcher";
import { useMemo } from "react";
import useSWR from "swr";
import { ProductCategoryIcon } from "../ProductCategoryIcon";
const CATEGORY_COLORS: Record<string, string> = {
  Cervezas: "bg-amber-100 text-amber-700 border-amber-200",
  Vinos: "bg-purple-100 text-purple-700 border-purple-200",
  Tragos: "bg-pink-100 text-pink-700 border-pink-200",
  Destilados: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Comida: "bg-orange-100 text-orange-700 border-orange-200",
  Otros: "bg-slate-100 text-slate-700 border-slate-200",
};
export function ProductCardImage({ product }: { product: Product }) {
  const stock = Number(product.stock ?? 0);
  const minStock = Number(product.minStock ?? 0);
  const isLowStock = stock <= minStock;

  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher
  );
  function getLooseCategoryLabel(category: unknown): string {
    if (typeof category === "string" && category.trim()) return category;
    if (category && typeof category === "object") {
      const value = category as { name?: unknown; id?: unknown };
      if (typeof value.name === "string" && value.name.trim())
        return value.name;
      if (typeof value.id === "string" && value.id.trim()) return value.id;
    }
    return "Sin categoria";
  }
  const getCategoryColor = (category: string) => {
    return (
      CATEGORY_COLORS[category] || "bg-blue-100 text-blue-700 border-blue-200"
    );
  };
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesData ?? []).forEach((category) => {
      if (category?.id) map.set(category.id, category.name);
    });
    return map;
  }, [categoriesData]);
  const getProductCategoryLabel = (item: Product) => {
    if (item.categoryId) {
      return categoryNameById.get(item.categoryId) ?? item.categoryId;
    }
    return getLooseCategoryLabel(
      (item as Product & { category?: unknown }).category
    );
  };
  return (
    <div className="relative aspect-video overflow-hidden bg-muted">
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-muted/60">
        <ProductCategoryIcon
          category={getProductCategoryLabel(product)}
          className="h-20 w-20 rounded-xl shadow-sm"
          iconClassName="h-10 w-10"
        />
      </div>

      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] uppercase font-black tracking-widest mt-1 ${getCategoryColor(
            getProductCategoryLabel(product)
          )}`}
        >
          {getProductCategoryLabel(product)}
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

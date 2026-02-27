// components/products/components/ProductCard/ProductCardImage.tsx
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/products";

export function ProductCardImage({ product }: { product: Product }) {
  return (
    <div className="aspect-video bg-muted relative overflow-hidden">
      <Image
        src={"/placeholder.svg"}
        alt={product.name}
        width={400}
        height={225}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />

      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <Badge
          variant="secondary"
          className="backdrop-blur-md bg-white/70 dark:bg-black/70 border-none shadow-sm text-xs"
        >
          {product.categoryId}
        </Badge>
      </div>
    </div>
  );
}

// components/products/components/ProductCard/ProductCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Product } from "@/lib/products";
import { ProductCardImage } from "./ProductCardImage";
import { ProductCardHeader } from "./ProductCardHeader";
import { ProductCardPrices } from "./ProductCardPrices";
import { ProductCardMeta } from "./ProductCardMeta";

export function ProductCard(props: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}) {
  const { product } = props;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-primary">
      <ProductCardImage product={product} />

      <CardContent className="p-5">
        <div className="space-y-4">
          <ProductCardHeader
            product={product}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
          />

          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {product.description}
          </p>

          <ProductCardPrices product={product} />
          <ProductCardMeta product={product} />
        </div>
      </CardContent>
    </Card>
  );
}

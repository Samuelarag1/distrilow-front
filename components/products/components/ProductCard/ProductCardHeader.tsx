// components/products/components/ProductCard/ProductCardHeader.tsx
import { Button } from "@/components/ui/button";
import { Product } from "@/lib/products";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductCardMenu } from "./ProductCardMenu";

export function ProductCardHeader(props: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}) {
  const { product } = props;

  return (
    <div className="flex items-start justify-between min-h-[3rem]">
      <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
        {product.name}
      </h3>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <ProductCardMenu
          product={product}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
        />
      </DropdownMenu>
    </div>
  );
}

// components/products/components/ProductCard/ProductCardMenu.tsx
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Product } from "@/lib/products";
import { Edit, Trash2 } from "lucide-react";

export function ProductCardMenu(props: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => props.onEdit(props.product)}>
        <Edit className="mr-2 h-4 w-4" />
        Editar Detalles
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={() => props.onDelete(props.product.id)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Eliminar Producto
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

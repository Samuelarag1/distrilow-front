// components/products/components/ProductsHeader.tsx
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function ProductsHeader(props: {
  activeBranchId: string | null;
  onCreate: () => void;
}) {
  const { activeBranchId, onCreate } = props;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Productos
        </h1>
        <p className="text-muted-foreground">
          Gestiona tu catálogo de productos
        </p>
      </div>

      <Button
        onClick={onCreate}
        className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
        title={
          !activeBranchId
            ? "Seleccioná una sucursal para gestionar productos"
            : undefined
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Nuevo Producto
      </Button>
    </div>
  );
}

// components/products/hooks/useProductSave.ts
import { useCallback, useState } from "react";
import { Product } from "@/lib/products";
import { useToast } from "@/hooks/use-toast";
import { normalizeProductPayload } from "../utils/normalizePayload";

export function useProductSave(opts: {
  editingProduct: Product | null;
  activeBranchId: string | null;
  addProduct: (payload: any) => Promise<any>;
  updateProduct: (id: string, payload: any) => Promise<any>;
  mutate: () => Promise<any>;
  onCloseDialog: () => void;
  onClearEditing: () => void;
}) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async (productData: Partial<Product>) => {
      setIsSaving(true);

      try {
        const resolvedBranchId =
          (productData as any).branchId ??
          opts.activeBranchId ??
          opts.editingProduct?.branchId ??
          null;

        if (!resolvedBranchId) {
          throw new Error("Selecciona una sucursal antes de guardar.");
        }

        const payload = normalizeProductPayload({
          ...productData,
        });

        if (opts.editingProduct) {
          await opts.updateProduct(opts.editingProduct.id, payload);
          toast({
            title: "Producto actualizado",
            description: "Los cambios han sido guardados correctamente.",
          });
        } else {
          await opts.addProduct(payload);
          toast({
            title: "Producto creado",
            description: "El nuevo producto ha sido agregado correctamente.",
          });
        }

        await opts.mutate();
        opts.onCloseDialog();
        opts.onClearEditing();
      } catch (err: any) {
        const msg =
          err?.response?.data?.details ||
          err?.response?.data?.message ||
          err?.details ||
          err?.message ||
          "Ocurrió un error inesperado.";

        toast({
          variant: "destructive",
          title: "Error al guardar",
          description: msg,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [opts, toast]
  );

  return { isSaving, handleSave };
}

// components/products/hooks/useProductSave.ts
import { useCallback, useState } from "react";
import { Product } from "@/lib/products";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import { normalizeProductPayload } from "../utils/normalizePayload";

export type ProductSaveInput = Partial<Product> & {
  imageFile?: File | null;
};

export function useProductSave(opts: {
  editingProduct: Product | null;
  activeBranchId: string | null;
  addProduct: (payload: any) => Promise<Product>;
  updateProduct: (id: string, payload: any) => Promise<Product | null>;
  mutate: () => Promise<any>;
  onCloseDialog: () => void;
  onClearEditing: () => void;
}) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(
    async (productData: ProductSaveInput) => {
      setIsSaving(true);

      try {
        const imageFile = productData.imageFile ?? null;
        const { imageFile: _imageFile, ...rawProductData } = productData;
        const resolvedBranchId =
          (rawProductData as any).branchId ??
          opts.activeBranchId ??
          opts.editingProduct?.branchId ??
          null;

        if (!resolvedBranchId) {
          throw new Error("Selecciona una sucursal antes de guardar.");
        }

        const payload = normalizeProductPayload({
          ...rawProductData,
        });

        let productId = opts.editingProduct?.id ?? null;

        if (opts.editingProduct) {
          const updated = await opts.updateProduct(opts.editingProduct.id, payload);
          productId = updated?.id ?? opts.editingProduct.id;
        } else {
          const created = await opts.addProduct(payload);
          productId = created?.id ?? null;
        }

        if (!productId) {
          throw new Error("No se pudo resolver el producto para subir la imagen.");
        }

        if (imageFile) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", imageFile);
          await backendApi.products.uploadImageByProductId(productId, uploadFormData);
        }

        if (opts.editingProduct) {
          toast({
            title: "Producto actualizado",
            description: imageFile
              ? "Se guardaron los cambios y se actualizo la imagen."
              : "Los cambios han sido guardados correctamente.",
          });
        } else {
          toast({
            title: "Producto creado",
            description: imageFile
              ? "El producto se creo y la imagen se subio correctamente."
              : "El nuevo producto ha sido agregado correctamente.",
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

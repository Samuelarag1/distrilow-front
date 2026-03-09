// components/products/hooks/useProductSave.ts
import { useCallback, useState } from "react";
import { Product } from "@/lib/products";
import { useToast } from "@/hooks/use-toast";
import { backendApi } from "@/lib/backend-api";
import { emitProductsSync } from "@/lib/products-live-sync";
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
        const reviewFlags = {
          priceReviewPending:
            typeof (rawProductData as any).priceReviewPending === "boolean"
              ? Boolean((rawProductData as any).priceReviewPending)
              : undefined,
          costReviewPending:
            typeof (rawProductData as any).costReviewPending === "boolean"
              ? Boolean((rawProductData as any).costReviewPending)
              : undefined,
        };
        const {
          priceReviewPending: _priceReviewPending,
          costReviewPending: _costReviewPending,
          ...baseProductData
        } = rawProductData as any;
        const resolvedBranchId =
          (baseProductData as any).branchId ??
          opts.activeBranchId ??
          opts.editingProduct?.branchId ??
          null;

        if (!resolvedBranchId) {
          throw new Error("Selecciona una sucursal antes de guardar.");
        }

        const payload = normalizeProductPayload(baseProductData);

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

        if (
          reviewFlags.priceReviewPending !== undefined ||
          reviewFlags.costReviewPending !== undefined
        ) {
          await backendApi.products.updateReviewFlags(productId, reviewFlags);
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
        emitProductsSync(resolvedBranchId);
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

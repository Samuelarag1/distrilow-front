"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useBranch } from "@/components/providers/business-provider";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/lib/products";
import { resolveProductImageUrl } from "@/lib/media-utils";
import type { ProductSaveInput } from "@/components/products/hooks/useProductSave";

// IMPORTANTE: usÃ¡ el enum que ya tenÃ©s (ajustÃ¡ el path a tu estructura real)
import { MeasurementType } from "@/lib/measurement-type";
import { swrFetcher } from "@/lib/swr-fetcher";
// Si no lo tenÃ©s en front, podÃ©s usar:
// type MeasurementType = "unit" | "gram" | "kg" | "ml" | "liter";

type ProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: ProductSaveInput) => Promise<void> | void;
  isSaving?: boolean;
};

type Category = {
  id: string;
  name: string;
  isActive?: boolean;
};

type OptionalNumericInput = number | "";

type ProductDialogFormState = {
  sku: string;
  barcode: string;
  pluCode: string;
  isWeighable: boolean;
  name: string;
  description: string;
  costPrice: OptionalNumericInput;
  wholesalePrice: OptionalNumericInput;
  retailPrice: OptionalNumericInput;
  marginPercent: number;
  priceReviewPending: boolean;
  costReviewPending: boolean;
  categoryId: string;
  brand: string;
  trackStock: boolean;
  allowNegativeStock: boolean;
  measurementType: MeasurementType;
  isActive: boolean;
  imageUrl: string;
};

const measurementOptions: { value: MeasurementType; label: string }[] = [
  { value: MeasurementType.UNIT, label: "Unidad" },
  { value: MeasurementType.GRAM, label: "Gramo" },
  { value: MeasurementType.KILOGRAM, label: "Kilogramo" },
  { value: MeasurementType.MILLILITER, label: "Mililitro" },
  { value: MeasurementType.LITER, label: "Litro" },
];

function parseOptionalNumberInput(value: string): OptionalNumericInput {
  if (value.trim() === "") return "";
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  isSaving = false,
}: ProductDialogProps) {
  const { activeBranchId } = useBranch();
  const { toast } = useToast();
  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher
  );

  const categoryOptions = useMemo(() => {
    return (categoriesData ?? [])
      .filter((c) => Boolean(c?.id) && Boolean(c?.name))
      .map((c) => ({ value: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesData]);

  const [formData, setFormData] = useState<ProductDialogFormState>({
    // Backend entity / dto
    sku: "",
    barcode: "",
    pluCode: "",
    isWeighable: false,
    name: "",
    description: "",
    costPrice: 0,
    wholesalePrice: 0,
    retailPrice: 0,
    marginPercent: 0,
    priceReviewPending: false,
    costReviewPending: false,
    categoryId: "",
    brand: "",
    trackStock: false,
    allowNegativeStock: false,
    measurementType: MeasurementType.UNIT as MeasurementType,
    // estado: en tu entity esActive boolean
    isActive: true,
    imageUrl: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localImagePreview, setLocalImagePreview] = useState<string | null>(
    null
  );

  // Si tu Product del front NO tiene algunos campos (sku, etc), ajustÃ¡ el mapeo.
  useEffect(() => {
    if (!open) return;

    if (product) {
      const productCategoryId =
        (product as any).categoryId ?? (product as any).category?.id ?? "";

      setFormData({
        sku: (product as any).sku ?? "",
        barcode: (product as any).barcode ?? "",
        pluCode: (product as any).pluCode ?? "",
        isWeighable: Boolean((product as any).isWeighable ?? false),
        name: product.name ?? "",
        description: product.description ?? "",
        costPrice: Number((product as any).costPrice ?? 0),
        wholesalePrice: Number(product.wholesalePrice ?? 0),
        retailPrice: Number((product as any).retailPrice ?? 0),
        marginPercent: Number((product as any).marginPercent ?? 0),
        priceReviewPending: Boolean(
          (product as any).priceReviewPending ?? false
        ),
        costReviewPending: Boolean((product as any).costReviewPending ?? false),
        categoryId: productCategoryId,
        brand: (product as any).brand ?? "",
        trackStock: Boolean((product as any).trackStock ?? false),
        allowNegativeStock: Boolean(
          (product as any).allowNegativeStock ?? false
        ),
        measurementType: ((product as any).measurementType ??
          MeasurementType.UNIT) as MeasurementType,
        isActive: Boolean((product as any).isActive ?? true),
        imageUrl: (product as any).imageUrl ?? "",
      });
      setImageFile(null);
      setLocalImagePreview(null);
    } else {
      setFormData({
        sku: "",
        barcode: "",
        pluCode: "",
        isWeighable: false,
        name: "",
        description: "",
        costPrice: 0,
        wholesalePrice: 0,
        retailPrice: 0,
        marginPercent: 0,
        priceReviewPending: false,
        costReviewPending: false,
        categoryId: "",
        brand: "",
        trackStock: false,
        allowNegativeStock: false,
        measurementType: MeasurementType.UNIT,
        isActive: true,
        imageUrl: "",
      });
      setImageFile(null);
      setLocalImagePreview(null);
    }
  }, [product, open]);

  useEffect(() => {
    if (!imageFile) {
      setLocalImagePreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setLocalImagePreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  const computeMargin = (cost: number, retail: number) => {
    if (!cost || cost <= 0) return 0;
    const m = ((retail - cost) / cost) * 100;
    // redondeo 2 decimales
    return Math.round(m * 100) / 100;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeBranchId) {
      toast({
        variant: "destructive",
        title: "Sucursal requerida",
        description: "Selecciona una sucursal antes de crear el producto.",
      });
      return;
    }
    if (!formData.name.trim()) return;
    const costPrice = Number(formData.costPrice);
    const wholesalePrice = Number(formData.wholesalePrice);
    const retailPrice = Number(formData.retailPrice);
    const normalizedPluCode = formData.pluCode.trim();

    if (
      !Number.isFinite(costPrice) ||
      !Number.isFinite(wholesalePrice) ||
      !Number.isFinite(retailPrice)
    ) {
      return;
    }
    if (costPrice < 0 || wholesalePrice < 0 || retailPrice < 0) return;

    // si querÃ©s autocalcular margen al guardar:
    const marginPercent = computeMargin(costPrice, retailPrice);

    await onSave({
      sku: normalizedPluCode,
      barcode: formData.barcode?.trim() || undefined,
      pluCode: normalizedPluCode || undefined,
      isWeighable: formData.isWeighable,
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      costPrice,
      wholesalePrice,
      retailPrice,
      marginPercent: marginPercent || undefined,
      priceReviewPending: formData.priceReviewPending,
      costReviewPending: formData.costReviewPending,
      categoryId: formData.categoryId?.trim() || undefined,
      brand: formData.brand?.trim() || undefined,
      trackStock: formData.trackStock,
      allowNegativeStock: formData.allowNegativeStock,
      measurementType: formData.measurementType,

      isActive: formData.isActive,
      imageUrl: formData.imageUrl?.trim() || undefined,
      imageFile,
    });
  };

  const disableForm = isSaving;
  const previewSrc =
    localImagePreview || formData.imageUrl || resolveProductImageUrl(product);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Modifica los datos del producto"
              : "Completa la informaciÃ³n del nuevo producto"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Ej. Cerveza IPA 500ml"
                  required
                  disabled={disableForm}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.categoryId || "__none__"}
                  onValueChange={(value) =>
                    setFormData((p) => ({
                      ...p,
                      categoryId: value === "__none__" ? "" : value,
                    }))
                  }
                  disabled={disableForm}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoria</SelectItem>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Código PLU</Label>
                <Input
                  value={formData.pluCode}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, pluCode: e.target.value }))
                  }
                  required
                  placeholder="Ej. 00011"
                  maxLength={5}
                  pattern="\d{5}"
                  title="El PLU debe tener exactamente 5 digitos"
                  disabled={disableForm}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Costo *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={formData.costPrice ?? ""}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        costPrice: parseOptionalNumberInput(e.target.value),
                      }))
                    }
                    required
                    disabled={disableForm}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Precio Minorista *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    value={formData.retailPrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        retailPrice: parseOptionalNumberInput(e.target.value),
                      }))
                    }
                    required
                    disabled={disableForm}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Precio Mayorista *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={formData.wholesalePrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        wholesalePrice: parseOptionalNumberInput(
                          e.target.value
                        ),
                      }))
                    }
                    required
                    disabled={disableForm}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Detalles adicionales..."
                rows={2}
                disabled={disableForm}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de medida</Label>
                <Select
                  value={formData.measurementType}
                  onValueChange={(value) =>
                    setFormData((p) => ({
                      ...p,
                      measurementType: value as MeasurementType,
                    }))
                  }
                  disabled={disableForm}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una medida" />
                  </SelectTrigger>
                  <SelectContent>
                    {measurementOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Flags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
                <div className="flex flex-col gap-1">
                  <Label className="font-bold">Producto pesable</Label>
                  <span className="text-xs text-muted-foreground">
                    Habilita PLU/peso para balanza
                  </span>
                </div>
                <Switch
                  checked={formData.isWeighable}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, isWeighable: checked }))
                  }
                  disabled={disableForm}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
                <div className="flex flex-col gap-1">
                  <Label className="font-bold">
                    Revision de precio pendiente
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    Marca el producto para revisar precio
                  </span>
                </div>
                <Switch
                  checked={formData.priceReviewPending}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, priceReviewPending: checked }))
                  }
                  disabled={disableForm}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex flex-col gap-1">
                <Label className="font-bold">Producto activo</Label>
                <span className="text-xs text-muted-foreground">
                  Define si aparece en el punto de venta
                </span>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({ ...p, isActive: checked }))
                }
                disabled={disableForm}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={disableForm}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="font-bold px-8"
              disabled={disableForm}
            >
              {isSaving
                ? "Guardando..."
                : product
                ? "Guardar Cambios"
                : "Crear Producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { Product } from "@/lib/products";

// IMPORTANTE: usÃ¡ el enum que ya tenÃ©s (ajustÃ¡ el path a tu estructura real)
import { MeasurementType } from "@/lib/measurement-type";
import { useUser } from "../providers/user-provider";
import { swrFetcher } from "@/lib/swr-fetcher";
// Si no lo tenÃ©s en front, podÃ©s usar:
// type MeasurementType = "unit" | "gram" | "kg" | "ml" | "liter";

type ProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Partial<Product>) => Promise<void> | void;
  isSaving?: boolean;
};

type Category = {
  id: string;
  name: string;
  isActive?: boolean;
};

const measurementOptions: { value: MeasurementType; label: string }[] = [
  { value: MeasurementType.UNIT, label: "Unidad" },
  { value: MeasurementType.GRAM, label: "Gramo" },
  { value: MeasurementType.KILOGRAM, label: "Kilogramo" },
  { value: MeasurementType.MILLILITER, label: "Mililitro" },
  { value: MeasurementType.LITER, label: "Litro" },
];

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  isSaving = false,
}: ProductDialogProps) {
  const { activeBranchId, availableBranches } = useBranch();
  const { branchId, branches, switchBranch } = useUser();
  const { data: categoriesData } = useSWR<Category[]>("/categories", swrFetcher);
  const defaultBranchId = useMemo(() => {
    return (
      activeBranchId ??
      availableBranches.find((b) => b.isDefault)?.id ??
      availableBranches[0]?.id ??
      null
    );
  }, [activeBranchId, availableBranches]);

  const categoryOptions = useMemo(() => {
    return (categoriesData ?? [])
      .filter((c) => Boolean(c?.id) && Boolean(c?.name))
      .map((c) => ({ value: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categoriesData]);

  const [formData, setFormData] = useState({
    // Backend entity / dto
    sku: "",
    barcode: "",
    name: "",
    description: "",
    costPrice: 0,
    wholesalePrice: 0,
    retailPrice: 0,
    marginPercent: 0,
    categoryId: "",
    brand: "",
    trackStock: false,
    allowNegativeStock: false,
    measurementType: MeasurementType.UNIT as MeasurementType,

    // branch (si tu API lo requiere en body, mantenelo; si NO, podÃ©s sacarlo)
    branchId: "",
    // estado: en tu entity esActive boolean
    isActive: true,
  });

  // Si tu Product del front NO tiene algunos campos (sku, etc), ajustÃ¡ el mapeo.
  useEffect(() => {
    if (!open) return;

    if (product) {
      const productCategoryId =
        (product as any).categoryId ?? (product as any).category?.id ?? "";

      setFormData({
        sku: (product as any).sku ?? "",
        barcode: (product as any).barcode ?? "",
        name: product.name ?? "",
        description: product.description ?? "",
        costPrice: Number((product as any).costPrice ?? 0),
        wholesalePrice: Number(product.wholesalePrice ?? 0),
        retailPrice: Number((product as any).retailPrice ?? 0),
        marginPercent: Number((product as any).marginPercent ?? 0),
        categoryId: productCategoryId,
        brand: (product as any).brand ?? "",
        trackStock: Boolean((product as any).trackStock ?? false),
        allowNegativeStock: Boolean(
          (product as any).allowNegativeStock ?? false
        ),
        measurementType: ((product as any).measurementType ??
          MeasurementType.UNIT) as MeasurementType,

        branchId: (product as any).branchId ?? defaultBranchId ?? "",
        isActive: Boolean((product as any).isActive ?? true),
      });
    } else {
      setFormData({
        sku: "",
        barcode: "",
        name: "",
        description: "",
        costPrice: 0,
        wholesalePrice: 0,
        retailPrice: 0,
        marginPercent: 0,
        categoryId: "",
        brand: "",
        trackStock: false,
        allowNegativeStock: false,
        measurementType: MeasurementType.UNIT,

        branchId: defaultBranchId ?? "",
        isActive: true,
      });
    }
  }, [product, open, defaultBranchId]);

  const computeMargin = (cost: number, retail: number) => {
    if (!cost || cost <= 0) return 0;
    const m = ((retail - cost) / cost) * 100;
    // redondeo 2 decimales
    return Math.round(m * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedBranchId =
      formData.branchId || branchId || defaultBranchId || (product as any)?.branchId;

    if (!resolvedBranchId) return;
    if (resolvedBranchId !== branchId) {
      await switchBranch(resolvedBranchId);
    }
    if (!formData.sku.trim()) return;
    if (!formData.name.trim()) return;
    if (
      formData.costPrice < 0 ||
      formData.wholesalePrice < 0 ||
      formData.retailPrice < 0
    )
      return;

    // si querÃ©s autocalcular margen al guardar:
    const marginPercent = computeMargin(
      formData.costPrice,
      formData.retailPrice
    );

    await onSave({
      sku: formData.sku.trim(),
      barcode: formData.barcode?.trim() || undefined,
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      costPrice: formData.costPrice,
      wholesalePrice: formData.wholesalePrice,
      retailPrice: formData.retailPrice,
      marginPercent: marginPercent || undefined,
      categoryId: formData.categoryId?.trim() || undefined,
      brand: formData.brand?.trim() || undefined,
      trackStock: formData.trackStock,
      allowNegativeStock: formData.allowNegativeStock,
      measurementType: formData.measurementType,

      isActive: formData.isActive,
    } as any);
  };

  const disableForm = isSaving;

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
            {/* Branch + Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sucursal *</Label>
                <Select
                  value={formData.branchId || undefined}
                  onValueChange={(value) => {
                    setFormData((p) => ({ ...p, branchId: value }));

                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sucursal" />
                  </SelectTrigger>

                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* si querÃ©s forzar siempre branch activa */}
                {/* <p className="text-xs text-muted-foreground">Los productos se crean en la sucursal activa.</p> */}
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
            </div>

            {/* SKU + Barcode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, sku: e.target.value }))
                  }
                  placeholder="Ej. ABC-123"
                  required
                  disabled={disableForm}
                />
              </div>

              <div className="space-y-2">
                <Label>CÃ³digo de barras</Label>
                <Input
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, barcode: e.target.value }))
                  }
                  placeholder="Opcional"
                  disabled={disableForm}
                />
              </div>
            </div>

            {/* Name */}
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

            {/* Description */}
            <div className="space-y-2">
              <Label>DescripciÃ³n</Label>
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

            {/* Prices */}
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
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        costPrice: Number.parseFloat(e.target.value) || 0,
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
                        wholesalePrice: Number.parseFloat(e.target.value) || 0,
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
                    className="pl-7"
                    value={formData.retailPrice}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        retailPrice: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    required
                    disabled={disableForm}
                  />
                </div>
              </div>
            </div>

            {/* Brand + Measurement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, brand: e.target.value }))
                  }
                  placeholder="Opcional"
                  disabled={disableForm}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de medida *</Label>
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
                  <Label className="font-bold">Rastrear stock</Label>
                  <span className="text-xs text-muted-foreground">
                    Si el producto debe afectar existencias
                  </span>
                </div>
                <Switch
                  checked={formData.trackStock}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, trackStock: checked }))
                  }
                  disabled={disableForm}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
                <div className="flex flex-col gap-1">
                  <Label className="font-bold">Permitir stock negativo</Label>
                  <span className="text-xs text-muted-foreground">
                    Solo si tu negocio lo permite
                  </span>
                </div>
                <Switch
                  checked={formData.allowNegativeStock}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, allowNegativeStock: checked }))
                  }
                  disabled={disableForm || !formData.trackStock}
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



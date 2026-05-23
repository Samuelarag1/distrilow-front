"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MeasurementType } from "@/lib/api-types";
import type { StockMode } from "@/components/products/hooks/useProductStockLinking";

const UNIT_OPTIONS: Array<{ value: MeasurementType; label: string }> = [
  { value: "unit", label: "Unidad" },
  { value: "gram", label: "Gramo" },
  { value: "kg", label: "Kilogramo" },
  { value: "ml", label: "Mililitro" },
  { value: "liter", label: "Litro" },
];

export function ProductStockLinkForm(props: {
  trackStock: boolean;
  onTrackStockChange: (value: boolean) => void;
  useSharedStock: boolean;
  onUseSharedStockChange: (value: boolean) => void;
  stockBaseProductId: string;
  onStockBaseProductIdChange: (value: string) => void;
  stockConsumptionQuantity: number | "";
  onStockConsumptionQuantityChange: (value: number | "") => void;
  stockBaseUnit: MeasurementType | string;
  onStockBaseUnitChange: (value: MeasurementType | string) => void;
  stockMode: StockMode;
  consumptionPreview: string;
  baseSearchQuery: string;
  onBaseSearchQueryChange: (value: string) => void;
  selectedBaseLabel?: string | null;
  baseOptions: Array<{
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    pluCode?: string | null;
  }>;
  isCheckingRelation?: boolean;
  isLoadingBaseOptions?: boolean;
  isBlockingModalOpen?: boolean;
  blockingMessage?: string | null;
  onCloseBlockingModal?: () => void;
  disabled?: boolean;
}) {
  const showSuggestions = props.baseSearchQuery.trim().length >= 2;
  const selectedBaseId = String(props.stockBaseProductId ?? "").trim();
  const hasSelectedSharedBase =
    selectedBaseId.length > 0 && selectedBaseId !== "__self__";

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="font-bold">Modelo de stock</Label>
          <p className="text-xs text-muted-foreground">
            El control de stock permanece activo para todos los productos.
          </p>
        </div>
        <Switch
          checked
          disabled
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={
            props.stockMode === "shared"
              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }
        >
          {props.stockMode === "shared" ? "Stock compartido" : "Stock propio"}
        </Badge>
        {props.trackStock && (
          <span className="text-xs text-muted-foreground">
            {props.consumptionPreview}
          </span>
        )}
      </div>

      {props.trackStock ? (
        <>
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Usar stock compartido</Label>
              <p className="text-[11px] text-muted-foreground">
                Si lo activas, este producto descuenta stock de otro producto base.
              </p>
            </div>
            <Switch
              checked={props.useSharedStock}
              onCheckedChange={props.onUseSharedStockChange}
              disabled={props.disabled || props.isCheckingRelation}
            />
          </div>

          {props.useSharedStock ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Producto base de stock</Label>
                <Input
                  value={props.baseSearchQuery}
                  onChange={(event) =>
                    props.onBaseSearchQueryChange(event.target.value)
                  }
                  placeholder="Buscar por nombre, SKU, PLU o codigo de barras"
                  disabled={props.disabled || props.isCheckingRelation}
                />
                {!showSuggestions && (
                  <p className="text-[11px] text-muted-foreground">
                    Escribe al menos 2 caracteres para buscar productos.
                  </p>
                )}
                {showSuggestions && props.isLoadingBaseOptions && (
                  <p className="text-[11px] text-muted-foreground">
                    Buscando productos...
                  </p>
                )}
                {showSuggestions && !props.isLoadingBaseOptions && (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
                    {props.baseOptions.length > 0 ? (
                      props.baseOptions.map((option) => (
                        <Button
                          key={option.id}
                          type="button"
                          variant="ghost"
                          className="h-auto w-full justify-start px-2 py-1.5 text-left"
                          onClick={() => {
                            props.onStockBaseProductIdChange(option.id);
                            props.onBaseSearchQueryChange(option.name);
                          }}
                          disabled={props.disabled || props.isCheckingRelation}
                        >
                          <span className="flex flex-col items-start">
                            <span className="font-medium">{option.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {option.sku ? `SKU ${option.sku}` : option.id}
                              {option.pluCode ? ` - PLU ${option.pluCode}` : ""}
                            </span>
                          </span>
                        </Button>
                      ))
                    ) : (
                      <p className="px-2 py-1 text-[11px] text-muted-foreground">
                        No hay resultados para la busqueda.
                      </p>
                    )}
                  </div>
                )}
                {hasSelectedSharedBase && (
                  <Badge variant="secondary" className="mt-1 gap-2">
                    Base: {props.selectedBaseLabel ?? selectedBaseId}
                    <button
                      type="button"
                      className="font-semibold"
                      onClick={() => {
                        props.onStockBaseProductIdChange("__self__");
                        props.onBaseSearchQueryChange("");
                      }}
                      disabled={props.disabled || props.isCheckingRelation}
                    >
                      x
                    </button>
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <Label>Factor de consumo</Label>
                <Input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={props.stockConsumptionQuantity}
                  onChange={(event) => {
                    const nextValue = event.target.value.trim();
                    if (!nextValue) {
                      props.onStockConsumptionQuantityChange("");
                      return;
                    }
                    const parsed = Number(nextValue);
                    props.onStockConsumptionQuantityChange(
                      Number.isFinite(parsed) ? parsed : ""
                    );
                  }}
                  placeholder="1"
                  disabled={props.disabled || props.isCheckingRelation}
                />
              </div>

              <div className="space-y-1">
                <Label>Unidad base</Label>
                <Select
                  value={String(props.stockBaseUnit || "unit")}
                  onValueChange={(value) =>
                    props.onStockBaseUnitChange(value as MeasurementType)
                  }
                  disabled={props.disabled || props.isCheckingRelation}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Seguimiento de stock desactivado para este producto.
        </p>
      )}

      <AlertDialog
        open={Boolean(props.isBlockingModalOpen)}
        onOpenChange={(open) => {
          if (!open) props.onCloseBlockingModal?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relacion bloqueada por stock existente</AlertDialogTitle>
            <AlertDialogDescription>
              {props.blockingMessage ??
                "Este producto tiene stock existente. Antes de relacionarlo, migrar/consolidar stock para evitar inconsistencias."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => props.onCloseBlockingModal?.()}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

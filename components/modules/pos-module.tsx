"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Minus,
  Trash2,
  Banknote,
  Search,
  ScanLine,
  Loader2,
  Clock3,
  ReceiptText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useUser } from "@/components/providers/user-provider";
import { Product } from "@/lib/products";
import {
  usePosProductSearch,
  POS_MIN_SEARCH_LENGTH,
} from "@/hooks/usePosProductSearch";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { backendApi, type ResolvedBarcodeProduct } from "@/lib/backend-api";
import { emitProductsSync } from "@/lib/products-live-sync";
import type { PaymentMethod, PriceType, PricingMode } from "@/lib/api-types";
import { resolveProductImageUrl } from "@/lib/media-utils";

interface CartItem extends Product {
  quantity: number;
  pricingMode: PricingMode;
  requestedPriceType?: PriceType;
  manualOverrideReason?: string;
  visualPriceType: PriceType;
  backendPriceType?: PriceType;
  backendPricingSource?: PricingMode;
  backendUnitPrice?: number;
  backendSubtotal?: number;
  backendBaseRetailPrice?: number;
  backendBaseWholesalePrice?: number;
  backendPricingRuleSnapshot?: unknown;
  backendManualOverrideReason?: string | null;
}

type PersistedPosCart = {
  version: 1;
  updatedAt: number;
  userId: string;
  branchId: string;
  cart: CartItem[];
  cashPaymentAmount: string;
  transferPaymentAmount: string;
  transferReference: string;
};

const POS_CART_STORAGE_PREFIX = "bms:pos-cart:v1";
const POS_CART_TTL_MS = 12 * 60 * 60 * 1000;
const POS_SCAN_CACHE_TTL_MS = 5_000;

type ScanCacheEntry = {
  cachedAt: number;
  value: ResolvedBarcodeProduct;
};

type PaymentPreviewRow = {
  method: PaymentMethod;
  amount: number;
  reference?: string;
};

type PosPreviewItem = {
  id: string;
  name: string;
  quantity: number;
  measurementType: Product["measurementType"];
  lineTotal: number;
  unitPrice: number;
  priceType: PriceType;
  pricingMode: PricingMode;
};

type PosCartListProps = {
  cart: CartItem[];
  isSaleCommitted: boolean;
  onUpdatePricingPreference: (
    id: string,
    selection: "AUTO" | "RETAIL" | "WHOLESALE"
  ) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onCommitManualQuantity: (item: CartItem, rawValue: string) => boolean;
  onRemoveFromCart: (id: string) => void;
};

type PosCatalogCardProps = PosCartListProps & {
  branchId: string | null;
  branchName: string;
  itemCount: number;
  isPaymentConfirmOpen: boolean;
  searchRefreshTick: number;
  onScanCode: (code: string) => Promise<boolean>;
  onSelectSearchProduct: (product: Product) => Promise<boolean>;
};

type PosPaymentCardProps = {
  cartLength: number;
  itemCount: number;
  total: number;
  totalInitialPayments: number;
  changeDuePreview: number;
  cashPaymentAmount: string;
  transferPaymentAmount: string;
  onCashPaymentAmountChange: (value: string) => void;
  onTransferPaymentAmountChange: (value: string) => void;
  onCashPaymentAmountBlur: () => void;
  onTransferPaymentAmountBlur: () => void;
  onHandlePayment: () => Promise<void>;
  onClearCart: () => void;
  isProcessingPayment: boolean;
  isSaleCommitted: boolean;
};

type PosPaymentConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isProcessingPayment: boolean;
  total: number;
  totalInitialPayments: number;
  itemCount: number;
  changeDuePreview: number;
  pendingAfterInitialPayments: number;
  previewItems: PosPreviewItem[];
  previewTotalUnits: number;
  previewBranchName: string;
  previewCashierName: string;
  paymentPreviewRows: PaymentPreviewRow[];
  onProcessPayment: () => Promise<void>;
};

function buildPosCartStorageKey(
  userId: string | null | undefined,
  branchId: string | null | undefined
) {
  if (!userId || !branchId) return null;
  return `${POS_CART_STORAGE_PREFIX}:${userId}:${branchId}`;
}

function parsePersistedPosCart(raw: string | null): PersistedPosCart | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPosCart>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    if (typeof parsed.userId !== "string" || !parsed.userId.trim()) return null;
    if (typeof parsed.branchId !== "string" || !parsed.branchId.trim())
      return null;

    const updatedAt = Number(parsed.updatedAt ?? 0);
    if (!Number.isFinite(updatedAt)) return null;
    if (Date.now() - updatedAt > POS_CART_TTL_MS) return null;

    const cart = Array.isArray(parsed.cart) ? (parsed.cart as CartItem[]) : [];

    return {
      version: 1,
      updatedAt,
      userId: parsed.userId,
      branchId: parsed.branchId,
      cart,
      cashPaymentAmount:
        typeof parsed.cashPaymentAmount === "string"
          ? parsed.cashPaymentAmount
          : "",
      transferPaymentAmount:
        typeof parsed.transferPaymentAmount === "string"
          ? parsed.transferPaymentAmount
          : "",
      transferReference:
        typeof parsed.transferReference === "string"
          ? parsed.transferReference
          : "",
    };
  } catch {
    return null;
  }
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickFirstFinite(values: unknown[], fallback = 0): number {
  for (const value of values) {
    const parsed = toSafeNumber(value, NaN);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function getLooseCategoryLabel(category: unknown): string {
  if (typeof category === "string" && category.trim()) return category;
  if (category && typeof category === "object") {
    const value = category as { name?: unknown; id?: unknown };
    if (typeof value.name === "string" && value.name.trim()) return value.name;
    if (typeof value.id === "string" && value.id.trim()) return value.id;
  }
  return "Sin categoria";
}

function isOpaqueIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  return (
    /^[0-9a-f]{24}$/i.test(trimmed) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      trimmed
    ) ||
    (/^[a-z0-9_-]{16,}$/i.test(trimmed) && !/\s/.test(trimmed))
  );
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getRetailPrice(product: Product) {
  return pickFirstFinite(
    [product.retailPrice, product.wholesalePrice, product.costPrice],
    0
  );
}

function getWholesalePrice(product: Product) {
  return pickFirstFinite(
    [product.wholesalePrice, product.retailPrice, product.costPrice],
    0
  );
}

function getWholesaleMinQuantity(product: Product): number | null {
  const threshold = toSafeNumber(product.wholesaleMinQuantity, NaN);
  if (!Number.isFinite(threshold) || threshold <= 0) return null;
  return threshold;
}

const QUANTITY_PRECISION_SCALE = 1000;

function toComparableQuantity(value: number): number {
  return Math.round(value * QUANTITY_PRECISION_SCALE);
}

function getAutoPriceType(item: CartItem): PriceType {
  const threshold = getWholesaleMinQuantity(item);
  if (threshold === null) {
    return item.visualPriceType ?? "RETAIL";
  }

  const quantity = toSafeNumber(item.quantity, 0);
  return toComparableQuantity(quantity) >= toComparableQuantity(threshold)
    ? "WHOLESALE"
    : "RETAIL";
}

function getRequestedOrDefaultPriceType(item: CartItem): PriceType {
  if (item.pricingMode === "MANUAL") {
    return item.requestedPriceType ?? "RETAIL";
  }
  return getAutoPriceType(item);
}

function getEstimatedUnitPrice(item: CartItem): number {
  const selectedPriceType = getRequestedOrDefaultPriceType(item);
  return selectedPriceType === "WHOLESALE"
    ? getWholesalePrice(item)
    : getRetailPrice(item);
}

function hasUsableBackendPricing(item: CartItem): boolean {
  if (item.pricingMode !== "AUTO") return false;

  const expectedPriceType = getAutoPriceType(item);
  if (item.backendPriceType && item.backendPriceType !== expectedPriceType) {
    return false;
  }

  const expectedUnitPrice =
    expectedPriceType === "WHOLESALE"
      ? getWholesalePrice(item)
      : getRetailPrice(item);
  const backendUnitPrice = toSafeNumber(item.backendUnitPrice, NaN);
  if (Number.isFinite(backendUnitPrice)) {
    return roundTo(backendUnitPrice, 2) === roundTo(expectedUnitPrice, 2);
  }

  const quantity = toSafeNumber(item.quantity, 0);
  const backendSubtotal = toSafeNumber(item.backendSubtotal, NaN);
  if (!Number.isFinite(backendSubtotal) || quantity <= 0) {
    return false;
  }

  return (
    roundTo(backendSubtotal / quantity, 2) === roundTo(expectedUnitPrice, 2)
  );
}

function getDisplayUnitPrice(item: CartItem): number {
  if (hasUsableBackendPricing(item)) {
    const backendUnitPrice = toSafeNumber(item.backendUnitPrice, NaN);
    if (Number.isFinite(backendUnitPrice) && backendUnitPrice >= 0) {
      return backendUnitPrice;
    }

    const quantity = toSafeNumber(item.quantity, 0);
    const backendSubtotal = toSafeNumber(item.backendSubtotal, NaN);
    if (Number.isFinite(backendSubtotal) && quantity > 0) {
      return backendSubtotal / quantity;
    }
  }

  return getEstimatedUnitPrice(item);
}

function getDisplayPriceType(item: CartItem): PriceType {
  if (hasUsableBackendPricing(item) && item.backendPriceType) {
    return item.backendPriceType;
  }
  return getRequestedOrDefaultPriceType(item);
}

function selectorValueFromItem(
  item: CartItem
): "AUTO" | "RETAIL" | "WHOLESALE" {
  if (item.pricingMode === "AUTO") return "AUTO";
  return item.requestedPriceType === "WHOLESALE" ? "WHOLESALE" : "RETAIL";
}

function getPriceTypeLabel(priceType: PriceType) {
  return priceType === "WHOLESALE" ? "Mayorista" : "Minorista";
}

function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "CASH":
      return "Efectivo";
    case "TRANSFER":
      return "Transferencia";
    case "DEBIT_CARD":
      return "Tarjeta de debito";
    case "CREDIT_CARD":
      return "Tarjeta de credito";
    case "MERCADO_PAGO":
      return "Mercado Pago";
    default:
      return "Otro";
  }
}

function formatThresholdQuantity(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function getMeasurementLabel(product: Product) {
  if (product.measurementType === "kg") return "kg";
  if (product.measurementType === "gram") return "gr";
  return "unidades";
}

function normalizeProductForPos(
  item: Partial<Product> & { id: string; name: string }
): Product {
  const measurementType =
    item.measurementType === "kg" ||
    item.measurementType === "gram" ||
    item.measurementType === "unit"
      ? item.measurementType
      : "unit";
  const parsedStock = toSafeNumber(item.stock, Number.NaN);

  return {
    ...item,
    id: item.id,
    sku: item.sku ?? item.id,
    name: item.name,
    costPrice: toSafeNumber(item.costPrice, 0),
    wholesalePrice: toSafeNumber(item.wholesalePrice, 0),
    retailPrice: toSafeNumber(item.retailPrice, 0),
    measurementType,
    isWeighable:
      item.isWeighable ??
      (measurementType === "kg" || measurementType === "gram"),
    stock: Number.isFinite(parsedStock) ? parsedStock : Number.NaN,
    price: pickFirstFinite(
      [item.retailPrice, item.wholesalePrice, item.costPrice],
      0
    ),
    category:
      typeof item.category === "string" && item.category.trim()
        ? item.category
        : typeof item.categoryId === "string" && item.categoryId.trim()
        ? item.categoryId
        : "Sin categoria",
    unit: measurementType,
  };
}

const POS_MONEY_FORMATTER = new Intl.NumberFormat("es-AR");

function formatMoney(value: unknown) {
  return POS_MONEY_FORMATTER.format(toSafeNumber(value, 0));
}

function sanitizeMoneyInput(value: string) {
  return value.replace(/[^\d,.\-]/g, "");
}

function parseMoneyInput(value: string) {
  const sanitized = sanitizeMoneyInput(value).trim();
  if (!sanitized) return 0;

  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;

  if (!hasComma && hasDot) {
    const dotMatches = sanitized.match(/\./g) ?? [];
    if (dotMatches.length > 1) {
      const integerValue = sanitized.replace(/[^\d-]/g, "");
      const parsed = Number(integerValue);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const decimalDigits = sanitized.length - lastDot - 1;
    if (decimalDigits === 3) {
      const integerValue = sanitized.replace(/[^\d-]/g, "");
      const parsed = Number(integerValue);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  const decimalSeparatorIndex = Math.max(lastComma, lastDot);

  if (decimalSeparatorIndex === -1) {
    const integerValue = sanitized.replace(/[^\d-]/g, "");
    const parsed = Number(integerValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const integerPart = sanitized
    .slice(0, decimalSeparatorIndex)
    .replace(/[^\d-]/g, "");
  const decimalPart = sanitized
    .slice(decimalSeparatorIndex + 1)
    .replace(/[^\d]/g, "");
  const normalized = `${integerPart || "0"}.${decimalPart}`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value: string) {
  const parsed = parseMoneyInput(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return POS_MONEY_FORMATTER.format(roundTo(parsed, 2));
}

function isWeighableProduct(product: Product) {
  return (
    Boolean(product.isWeighable) ||
    product.measurementType === "kg" ||
    product.measurementType === "gram"
  );
}

function getQuantityStep(product: Product) {
  if (product.measurementType === "kg") return 0.001;
  if (product.measurementType === "gram") return 1;
  return 1;
}

function getProductSearchMetaLabel(product: Product) {
  const categoryLabel = getLooseCategoryLabel(
    (product as Product & { category?: unknown }).category
  );
  if (categoryLabel !== "Sin categoria" && !isOpaqueIdentifier(categoryLabel)) {
    return categoryLabel;
  }

  const details: string[] = [];
  const brand = typeof product.brand === "string" ? product.brand.trim() : "";
  const sku = typeof product.sku === "string" ? product.sku.trim() : "";
  const barcode = typeof product.barcode === "string" ? product.barcode.trim() : "";
  const pluCode = typeof product.pluCode === "string" ? product.pluCode.trim() : "";

  if (brand && !isOpaqueIdentifier(brand)) {
    details.push(brand);
  }

  if (sku && sku !== product.id && !isOpaqueIdentifier(sku)) {
    details.push(`SKU ${sku}`);
  }

  if (barcode) {
    details.push(`Cod. ${barcode}`);
  } else if (pluCode) {
    details.push(`PLU ${pluCode}`);
  }

  if (details.length > 0) {
    return details.slice(0, 2).join(" / ");
  }

  if (product.measurementType === "kg") return "Venta por kg";
  if (product.measurementType === "gram") return "Venta por gramos";
  return "Producto sin categoria";
}

function getStockBadgeClassName(product: Product) {
  if (product.trackStock === false) {
    return "border-slate-300 bg-slate-50 text-slate-600";
  }

  const stock = toSafeNumber(product.stock, Number.NaN);
  const minStock = Number(product.minStock ?? 0);

  if (!Number.isFinite(stock)) {
    return "border-slate-300 bg-slate-50 text-slate-600";
  }

  if (stock <= minStock) {
    return "border-red-300 bg-red-50 text-red-700";
  }

  const warningThreshold = minStock > 0 ? Math.ceil(minStock * 1.5) : 3;
  if (stock <= warningThreshold) {
    return "border-yellow-300 bg-yellow-50 text-yellow-700";
  }

  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

function getStockBadgeLabel(product: Product) {
  if (product.trackStock === false) {
    return "sin control";
  }

  const stock = toSafeNumber(product.stock, Number.NaN);
  return Number.isFinite(stock)
    ? `stock ${formatThresholdQuantity(stock)}`
    : "stock --";
}

function getCartLineTotal(item: CartItem) {
  const quantity = toSafeNumber(item.quantity, 0);
  if (hasUsableBackendPricing(item)) {
    const backendUnitPrice = toSafeNumber(item.backendUnitPrice, NaN);
    if (Number.isFinite(backendUnitPrice) && backendUnitPrice >= 0) {
      return backendUnitPrice * quantity;
    }

    const backendSubtotal = toSafeNumber(item.backendSubtotal, NaN);
    if (Number.isFinite(backendSubtotal) && backendSubtotal >= 0) {
      return backendSubtotal;
    }
  }

  return getDisplayUnitPrice(item) * quantity;
}

function getErrorMessage(error: unknown, fallback: string) {
  const normalizeStockMessage = (message: string) => {
    const normalized = message.trim().toLowerCase();
    const isStockError =
      normalized.includes("not enouth stock") ||
      normalized.includes("not enough stock") ||
      normalized.includes("insufficient stock");

    if (isStockError) {
      return "No hay stock suficiente para completar la venta.";
    }

    return message;
  };

  if (error instanceof Error && error.message.trim()) {
    return normalizeStockMessage(error.message);
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return normalizeStockMessage(error.message);
  }

  return fallback;
}

// function getAutoRuleLabel(item: CartItem): string | null {
//   const threshold = getWholesaleMinQuantity(item);
//   if (threshold === null) return null;
//   return `Auto: minorista hasta ${formatThresholdQuantity(
//     threshold
//   )} ${getMeasurementLabel(item)} y mayorista por encima.`;
// }

const PosCartItemCard = memo(function PosCartItemCard({
  item,
  isSaleCommitted,
  onUpdatePricingPreference,
  onUpdateQuantity,
  onCommitManualQuantity,
  onRemoveFromCart,
}: {
  item: CartItem;
  isSaleCommitted: boolean;
  onUpdatePricingPreference: (
    id: string,
    selection: "AUTO" | "RETAIL" | "WHOLESALE"
  ) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onCommitManualQuantity: (item: CartItem, rawValue: string) => boolean;
  onRemoveFromCart: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/60">
          <img
            src={resolveProductImageUrl(item)}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = "/placeholder.svg";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate text-sm font-medium">{item.name}</h4>
            <p className="whitespace-nowrap text-xs font-semibold">
              Subtotal: ${roundTo(getCartLineTotal(item), 2).toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            ${toSafeNumber(getDisplayUnitPrice(item), 0).toFixed(2)} /{" "}
            {item.measurementType === "kg"
              ? "kg"
              : item.measurementType === "gram"
              ? "gr"
              : "unidad"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="h-5 text-[10px]">
              {getPriceTypeLabel(getDisplayPriceType(item))}
            </Badge>
            <Badge
              variant="outline"
              className={`h-5 text-[10px] ${getStockBadgeClassName(item)}`}
            >
              {getStockBadgeLabel(item)}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={
                selectorValueFromItem(item) === "AUTO" ? "default" : "outline"
              }
              className="h-7 px-2 text-[10px]"
              disabled={isSaleCommitted}
              onClick={() => onUpdatePricingPreference(item.id, "AUTO")}
            >
              Automatico
            </Button>
            <Button
              size="sm"
              variant={
                selectorValueFromItem(item) === "RETAIL" ? "default" : "outline"
              }
              className="h-7 px-2 text-[10px]"
              disabled={isSaleCommitted}
              onClick={() => onUpdatePricingPreference(item.id, "RETAIL")}
            >
              Por menor
            </Button>
            <Button
              size="sm"
              variant={
                selectorValueFromItem(item) === "WHOLESALE"
                  ? "default"
                  : "outline"
              }
              className="h-7 px-2 text-[10px]"
              disabled={isSaleCommitted}
              onClick={() => onUpdatePricingPreference(item.id, "WHOLESALE")}
            >
              Por mayor
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onUpdateQuantity(
                item.id,
                roundTo(item.quantity - getQuantityStep(item), 3)
              )
            }
            disabled={isSaleCommitted}
          >
            <Minus className="h-3 w-3" />
          </Button>
          {isWeighableProduct(item) ? (
            <Input
              type="number"
              inputMode="decimal"
              min={getQuantityStep(item)}
              step={getQuantityStep(item)}
              defaultValue={formatThresholdQuantity(toSafeNumber(item.quantity, 0))}
              key={`${item.id}-${item.quantity}`}
              className="h-8 w-24 text-center text-sm"
              placeholder={item.measurementType === "kg" ? "kg o gramos" : "Cantidad"}
              title={
                item.measurementType === "kg"
                  ? "Puedes ingresar kg (ej. 1.5) o gramos enteros (ej. 1500)."
                  : undefined
              }
              disabled={isSaleCommitted}
              onBlur={(event) => {
                const committed = onCommitManualQuantity(item, event.target.value);
                if (!committed) {
                  event.target.value = formatThresholdQuantity(
                    toSafeNumber(item.quantity, 0)
                  );
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const committed = onCommitManualQuantity(
                    item,
                    event.currentTarget.value
                  );
                  if (!committed) {
                    event.currentTarget.value = formatThresholdQuantity(
                      toSafeNumber(item.quantity, 0)
                    );
                  }
                  event.currentTarget.blur();
                }
              }}
            />
          ) : (
            <span className="w-10 text-center text-sm">
              {Math.trunc(item.quantity)}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onUpdateQuantity(
                item.id,
                roundTo(item.quantity + getQuantityStep(item), 3)
              )
            }
            disabled={isSaleCommitted}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemoveFromCart(item.id)}
          disabled={isSaleCommitted}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});

PosCartItemCard.displayName = "PosCartItemCard";

const PosCartList = memo(function PosCartList({
  cart,
  isSaleCommitted,
  onUpdatePricingPreference,
  onUpdateQuantity,
  onCommitManualQuantity,
  onRemoveFromCart,
}: PosCartListProps) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 px-6 py-10 text-center">
        <Image
          src="/emptystate.png"
          alt="Empty state POS"
          width={360}
          height={360}
          className="mb-5 h-44 w-auto max-w-[88%] object-contain drop-shadow-sm"
          priority
        />
        <p className="text-sm font-semibold text-foreground">
          No hay productos agregados
        </p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Busca o escanea articulos para comenzar una venta y verlos aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
      {cart.map((item) => (
        <PosCartItemCard
          key={item.id}
          item={item}
          isSaleCommitted={isSaleCommitted}
          onUpdatePricingPreference={onUpdatePricingPreference}
          onUpdateQuantity={onUpdateQuantity}
          onCommitManualQuantity={onCommitManualQuantity}
          onRemoveFromCart={onRemoveFromCart}
        />
      ))}
    </div>
  );
});

PosCartList.displayName = "PosCartList";

const PosCatalogCard = memo(function PosCatalogCard({
  branchId,
  branchName,
  cart,
  itemCount,
  isSaleCommitted,
  isPaymentConfirmOpen,
  searchRefreshTick,
  onScanCode,
  onSelectSearchProduct,
  onUpdatePricingPreference,
  onUpdateQuantity,
  onCommitManualQuantity,
  onRemoveFromCart,
}: PosCatalogCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const debouncedSearch = useDebouncedValue(deferredSearchQuery, 250);
  const {
    products: searchResults,
    isLoading: isSearchLoading,
    canSearch,
    mutateProducts,
  } = usePosProductSearch({
    branchId,
    query: debouncedSearch,
    take: 8,
  });

  const searchSuggestions = useMemo(
    () => searchResults.slice(0, 8),
    [searchResults]
  );
  const shouldShowSearchDropdown =
    isSearchDropdownOpen && searchQuery.trim().length > 0;

  useEffect(() => {
    if (!searchRefreshTick || !canSearch) return;
    void mutateProducts();
  }, [searchRefreshTick, canSearch, mutateProducts]);

  useEffect(() => {
    if (isPaymentConfirmOpen) return;

    const timeoutId = window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isPaymentConfirmOpen]);

  const focusScanInput = useCallback(() => {
    if (isSaleCommitted || isPaymentConfirmOpen) return;
    window.requestAnimationFrame(() => {
      scanInputRef.current?.focus({ preventScroll: true });
    });
  }, [isSaleCommitted, isPaymentConfirmOpen]);

  const handleScan = useCallback(async (rawCode?: string) => {
    const code = (rawCode ?? scanQuery).trim();
    if (!code) {
      focusScanInput();
      return;
    }

    const added = await onScanCode(code);
    if (added) {
      setScanQuery("");
    }
    setIsSearchDropdownOpen(false);
    focusScanInput();
  }, [scanQuery, onScanCode, focusScanInput]);

  const handleSelectProduct = useCallback(
    async (product: Product) => {
      if (isSaleCommitted) return;

      const added = await onSelectSearchProduct(product);
      if (!added) return;

      setSearchQuery("");
      setIsSearchDropdownOpen(false);
      focusScanInput();
    },
    [isSaleCommitted, onSelectSearchProduct, focusScanInput]
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scanInputRef}
                autoFocus
                placeholder="Escanear o escribir codigo de barras"
                value={scanQuery}
                onChange={(event) => setScanQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Tab") {
                    event.preventDefault();
                    void handleScan(event.currentTarget.value);
                  }
                }}
                className="pl-8"
                disabled={isSaleCommitted}
              />
            </div>
            <Button onClick={() => void handleScan()} disabled={isSaleCommitted}>
              Agregar
            </Button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => {
                    setIsSearchDropdownOpen(false);
                  }, 120);
                }}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsSearchDropdownOpen(false);
                    return;
                  }

                  if (
                    event.key === "Enter" &&
                    searchSuggestions.length > 0 &&
                    !isSearchLoading
                  ) {
                    event.preventDefault();
                    void handleSelectProduct(searchSuggestions[0]);
                  }
                }}
                className="pl-8"
              />
              {shouldShowSearchDropdown ? (
                <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-xl">
                  {!canSearch ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      Escribe al menos {POS_MIN_SEARCH_LENGTH} caracteres.
                    </p>
                  ) : isSearchLoading ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando productos...
                    </div>
                  ) : searchSuggestions.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-1">
                      {searchSuggestions.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            void handleSelectProduct(product);
                          }}
                        >
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
                            <img
                              src={resolveProductImageUrl(product)}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {product.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {getProductSearchMetaLabel(product)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className={`h-5 min-w-[76px] justify-center px-2 text-[10px] font-black uppercase ${getStockBadgeClassName(
                                product
                              )}`}
                            >
                              {getStockBadgeLabel(product)}
                            </Badge>
                            <span className="text-xs font-bold text-primary">
                              ${formatMoney(getRetailPrice(product))}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      No se encontraron productos para: {searchQuery}.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sucursal activa:{" "}
            <span className="font-semibold text-foreground">{branchName}</span>
          </p>
        </div>
      </CardHeader>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Productos agregados</span>
          <Badge variant="secondary">{itemCount} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <PosCartList
          cart={cart}
          isSaleCommitted={isSaleCommitted}
          onUpdatePricingPreference={onUpdatePricingPreference}
          onUpdateQuantity={onUpdateQuantity}
          onCommitManualQuantity={onCommitManualQuantity}
          onRemoveFromCart={onRemoveFromCart}
        />
      </CardContent>
    </Card>
  );
});

PosCatalogCard.displayName = "PosCatalogCard";

const PosPaymentCard = memo(function PosPaymentCard({
  cartLength,
  itemCount,
  total,
  totalInitialPayments,
  changeDuePreview,
  cashPaymentAmount,
  transferPaymentAmount,
  onCashPaymentAmountChange,
  onTransferPaymentAmountChange,
  onCashPaymentAmountBlur,
  onTransferPaymentAmountBlur,
  onHandlePayment,
  onClearCart,
  isProcessingPayment,
  isSaleCommitted,
}: PosPaymentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pagar</span>
          <Badge variant="secondary">{itemCount} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal:</span>
            <span>${formatMoney(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Pagos iniciales:</span>
            <span>${formatMoney(totalInitialPayments)}</span>
          </div>
          {changeDuePreview > 0 && (
            <div className="flex justify-between text-sm font-semibold text-emerald-700">
              <span>Vuelto a entregar:</span>
              <span>${formatMoney(changeDuePreview)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total:</span>
            <span>${formatMoney(total)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Pagos
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-md font-bold text-muted-foreground">
                  Efectivo
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashPaymentAmount}
                  onChange={(event) =>
                    onCashPaymentAmountChange(event.target.value)
                  }
                  onBlur={onCashPaymentAmountBlur}
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-md font-bold text-muted-foreground">
                  Transferencia
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={transferPaymentAmount}
                  onChange={(event) =>
                    onTransferPaymentAmountChange(event.target.value)
                  }
                  onBlur={onTransferPaymentAmountBlur}
                  className="h-10"
                />
              </div>
            </div>
          </div>
          {cartLength === 0 ? (
            <p className="text-center text-xs text-muted-foreground">
              Agrega productos para habilitar el cobro.
            </p>
          ) : null}
          <Button
            className="w-full"
            onClick={() => void onHandlePayment()}
            disabled={isProcessingPayment || cartLength === 0}
          >
            <Banknote className="mr-2 h-4 w-4" />
            {isSaleCommitted ? "Nueva venta" : "Registrar Venta"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" variant="ghost" disabled={cartLength === 0}>
                Limpiar Carrito
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpiar el carrito?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se quitaran todos los productos seleccionados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onClearCart}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Limpiar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
});

PosPaymentCard.displayName = "PosPaymentCard";

function PosPaymentConfirmDialog({
  open,
  onOpenChange,
  isProcessingPayment,
  total,
  totalInitialPayments,
  itemCount,
  changeDuePreview,
  pendingAfterInitialPayments,
  previewItems,
  previewTotalUnits,
  previewBranchName,
  previewCashierName,
  paymentPreviewRows,
  onProcessPayment,
}: PosPaymentConfirmDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isProcessingPayment) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1120px)] max-w-5xl flex-col gap-0 overflow-hidden border-0 bg-background p-0 shadow-2xl sm:max-h-[90vh]">
        <div className="shrink-0 border-b bg-gradient-to-br from-[#E74E7F]/10 via-background to-[#E74E7F]/5 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <Badge className="rounded-full bg-[#E74E7F]/70 px-3 py-1 text-xs font-semibold text-white hover:bg-[#E74E7F]/70">
                Confirmacion previa
              </Badge>
              <DialogHeader className="mt-4 text-left">
                <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight sm:text-3xl">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E74E7F]/15 text-[#E74E7F]">
                    <ReceiptText className="h-6 w-6" />
                  </span>
                  Confirmar venta
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Revisa el detalle, los pagos cargados y el importe a devolver
                  antes de registrar definitivamente la venta.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    ${formatMoney(total)}
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Cobrado
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    ${formatMoney(totalInitialPayments)}
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Items
                  </p>
                  <p className="mt-2 text-2xl font-black tracking-tight">
                    {itemCount}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatThresholdQuantity(previewTotalUnits)} unidades totales
                  </p>
                </div>
              </div>
            </div>

            <div className="xl:w-[310px]">
              <div className="rounded-[28px] border border-[#E74E7F]/25 bg-[#E74E7F]/70 p-5 text-white shadow-xl shadow-[#E74E7F]/20 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
                  {changeDuePreview > 0
                    ? "Vuelto a entregar"
                    : pendingAfterInitialPayments > 0
                    ? "Saldo pendiente"
                    : "Pago exacto"}
                </p>
                <p className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                  $
                  {formatMoney(
                    changeDuePreview > 0
                      ? changeDuePreview
                      : pendingAfterInitialPayments > 0
                      ? pendingAfterInitialPayments
                      : 0
                  )}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/90">
                  {changeDuePreview > 0
                    ? "Este es el importe que deberias devolver al cliente al cerrar la operacion."
                    : pendingAfterInitialPayments > 0
                    ? "La venta se registrara con saldo pendiente si continuas."
                    : "El importe cargado coincide exactamente con el total."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 sm:p-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Detalle vendido
              </h3>
            </div>

            <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[38vh]">
              {previewItems.map((item) => (
                <div key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[11px]">
                          {formatThresholdQuantity(item.quantity)}{" "}
                          {item.measurementType === "kg"
                            ? "kg"
                            : item.measurementType === "gram"
                            ? "gr"
                            : "un"}
                        </Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {getPriceTypeLabel(item.priceType)}
                        </Badge>
                        {item.pricingMode === "MANUAL" ? (
                          <Badge className="bg-[#E74E7F]/15 text-[11px] font-semibold text-[#C43C69] hover:bg-[#E74E7F]/15">
                            Manual
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black">
                        ${formatMoney(item.lineTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${formatMoney(item.unitPrice)} c/u
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/20 p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Datos de la operacion
                </h3>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Sucursal</span>
                  <span className="text-right font-semibold">
                    {previewBranchName}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Cajero</span>
                  <span className="text-right font-semibold">
                    {previewCashierName}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Productos</span>
                  <span className="text-right font-semibold">{itemCount}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Unidades</span>
                  <span className="text-right font-semibold">
                    {formatThresholdQuantity(previewTotalUnits)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Pagos cargados
              </h3>
              <div className="mt-4 space-y-3">
                {paymentPreviewRows.length > 0 ? (
                  paymentPreviewRows.map((payment, index) => (
                    <div
                      key={`${payment.method}-${index}`}
                      className="rounded-xl border bg-muted/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {getPaymentMethodLabel(payment.method)}
                          </p>
                          {payment.reference ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ref: {payment.reference}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-sm font-black">
                          ${formatMoney(payment.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No cargaste pagos iniciales. La venta se registrara con
                    saldo pendiente.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Totales
              </h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total venta</span>
                  <span className="font-semibold">${formatMoney(total)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Cobrado</span>
                  <span className="font-semibold">
                    ${formatMoney(totalInitialPayments)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Pendiente</span>
                  <span className="font-semibold">
                    ${formatMoney(pendingAfterInitialPayments)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between gap-3 text-base font-black">
                  <span>
                    {changeDuePreview > 0
                      ? "Vuelto"
                      : pendingAfterInitialPayments > 0
                      ? "Saldo"
                      : "Diferencia"}
                  </span>
                  <span>
                    $
                    {formatMoney(
                      changeDuePreview > 0
                        ? changeDuePreview
                        : pendingAfterInitialPayments > 0
                        ? pendingAfterInitialPayments
                        : 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-6">
          <p className="text-sm text-muted-foreground">
            Si todo esta correcto, confirma para registrar la venta.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessingPayment}
            >
              Volver
            </Button>
            <Button
              onClick={() => void onProcessPayment()}
              className="min-w-[220px]"
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirmar y Registrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function POSModule() {
  const { currentUser, branchId, branches } = useUser();
  const { toast } = useToast();

  const canManageCash =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "cashier" ||
    currentUser?.role === "seller";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchRefreshTick, setSearchRefreshTick] = useState(0);
  const [cashPaymentAmount, setCashPaymentAmount] = useState("");
  const [transferPaymentAmount, setTransferPaymentAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSaleCommitted, setIsSaleCommitted] = useState(false);
  const previousBranchRef = useRef<string | null>(null);
  const cartPersistenceReadyRef = useRef(false);
  const cartPersistenceTimeoutRef = useRef<number | null>(null);
  const scanCacheRef = useRef<Map<string, ScanCacheEntry>>(new Map());
  const posCartStorageKey = useMemo(
    () => buildPosCartStorageKey(currentUser?.id ?? null, branchId ?? null),
    [currentUser?.id, branchId]
  );
  const handleCashPaymentAmountChange = useCallback((value: string) => {
    setCashPaymentAmount(sanitizeMoneyInput(value));
  }, []);
  const handleTransferPaymentAmountChange = useCallback((value: string) => {
    setTransferPaymentAmount(sanitizeMoneyInput(value));
  }, []);
  const handleCashPaymentAmountBlur = useCallback(() => {
    setCashPaymentAmount((prev) => formatMoneyInput(prev));
  }, []);
  const handleTransferPaymentAmountBlur = useCallback(() => {
    setTransferPaymentAmount((prev) => formatMoneyInput(prev));
  }, []);

  useEffect(() => {
    cartPersistenceReadyRef.current = false;

    if (typeof window === "undefined") return;
    if (!posCartStorageKey || !branchId) {
      cartPersistenceReadyRef.current = true;
      return;
    }

    const persisted = parsePersistedPosCart(
      window.localStorage.getItem(posCartStorageKey)
    );

    if (!persisted) {
      window.localStorage.removeItem(posCartStorageKey);
      cartPersistenceReadyRef.current = true;
      return;
    }

    const restoredCart = persisted.cart.filter(
      (item) => !item?.branchId || item.branchId === branchId
    );

    if (restoredCart.length > 0) {
      setCart(restoredCart);
      setCashPaymentAmount(persisted.cashPaymentAmount);
      setTransferPaymentAmount(persisted.transferPaymentAmount);
      setTransferReference(persisted.transferReference);
      setIsSaleCommitted(false);

      toast({
        title: "Carrito recuperado",
        description: `Se recuperaron ${restoredCart.length} productos del ultimo intento.`,
      });
    } else {
      window.localStorage.removeItem(posCartStorageKey);
    }

    cartPersistenceReadyRef.current = true;
  }, [posCartStorageKey, branchId, toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!posCartStorageKey) return;
    if (!cartPersistenceReadyRef.current) return;

    if (cartPersistenceTimeoutRef.current !== null) {
      window.clearTimeout(cartPersistenceTimeoutRef.current);
    }

    cartPersistenceTimeoutRef.current = window.setTimeout(() => {
      const isEmptyState =
        cart.length === 0 &&
        !cashPaymentAmount.trim() &&
        !transferPaymentAmount.trim() &&
        !transferReference.trim();

      if (isEmptyState) {
        window.localStorage.removeItem(posCartStorageKey);
        return;
      }

      if (!currentUser?.id || !branchId) return;

      const payload: PersistedPosCart = {
        version: 1,
        updatedAt: Date.now(),
        userId: currentUser.id,
        branchId,
        cart,
        cashPaymentAmount,
        transferPaymentAmount,
        transferReference,
      };

      window.localStorage.setItem(posCartStorageKey, JSON.stringify(payload));
    }, 180);

    return () => {
      if (cartPersistenceTimeoutRef.current !== null) {
        window.clearTimeout(cartPersistenceTimeoutRef.current);
        cartPersistenceTimeoutRef.current = null;
      }
    };
  }, [
    posCartStorageKey,
    cart,
    cashPaymentAmount,
    transferPaymentAmount,
    transferReference,
    currentUser?.id,
    branchId,
  ]);

  useEffect(() => {
    if (!branchId) {
      previousBranchRef.current = null;
      scanCacheRef.current.clear();
      setIsPaymentConfirmOpen(false);
      return;
    }

    if (previousBranchRef.current === null) {
      previousBranchRef.current = branchId;
      return;
    }

    const branchChanged = previousBranchRef.current !== branchId;
    if (branchChanged) {
      scanCacheRef.current.clear();
      setIsPaymentConfirmOpen(false);
    }

    if (branchChanged && cart.length > 0) {
      setCart([]);
      setIsSaleCommitted(false);
      toast({
        title: "Sucursal cambiada",
        description:
          "Se limpio el carrito para evitar mezclar productos entre sucursales.",
      });
    }

    previousBranchRef.current = branchId;
  }, [branchId, cart.length, toast]);

  const getProductSearchMetaLabel = (product: Product) => {
    const categoryLabel = getLooseCategoryLabel(
      (product as Product & { category?: unknown }).category
    );
    if (categoryLabel !== "Sin categoria" && !isOpaqueIdentifier(categoryLabel)) {
      return categoryLabel;
    }

    const details: string[] = [];
    const brand = typeof product.brand === "string" ? product.brand.trim() : "";
    const sku = typeof product.sku === "string" ? product.sku.trim() : "";
    const barcode =
      typeof product.barcode === "string" ? product.barcode.trim() : "";
    const pluCode =
      typeof product.pluCode === "string" ? product.pluCode.trim() : "";

    if (brand && !isOpaqueIdentifier(brand)) {
      details.push(brand);
    }

    if (sku && sku !== product.id && !isOpaqueIdentifier(sku)) {
      details.push(`SKU ${sku}`);
    }

    if (barcode) {
      details.push(`Cod. ${barcode}`);
    } else if (pluCode) {
      details.push(`PLU ${pluCode}`);
    }

    if (details.length > 0) {
      return details.slice(0, 2).join(" / ");
    }

    if (product.measurementType === "kg") return "Venta por kg";
    if (product.measurementType === "gram") return "Venta por gramos";
    return "Producto sin categoria";
  };

  const getStockBadgeClassName = (product: Product) => {
    if (product.trackStock === false) {
      return "border-slate-300 bg-slate-50 text-slate-600";
    }

    const stock = toSafeNumber(product.stock, Number.NaN);
    const minStock = Number(product.minStock ?? 0);

    if (!Number.isFinite(stock)) {
      return "border-slate-300 bg-slate-50 text-slate-600";
    }

    if (stock <= minStock) {
      return "border-red-300 bg-red-50 text-red-700";
    }

    const warningThreshold = minStock > 0 ? Math.ceil(minStock * 1.5) : 3;
    if (stock <= warningThreshold) {
      return "border-yellow-300 bg-yellow-50 text-yellow-700";
    }

    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  };

  const getStockBadgeLabel = (product: Product) => {
    if (product.trackStock === false) {
      return "sin control";
    }

    const stock = toSafeNumber(product.stock, Number.NaN);
    return Number.isFinite(stock)
      ? `stock ${formatThresholdQuantity(stock)}`
      : "stock --";
  };

  const addToCart = useCallback((
    product: Product,
    options?: {
      quantity?: number;
      backendUnitPrice?: number;
      backendSubtotal?: number;
      backendPriceType?: PriceType;
      backendPricingSource?: PricingMode;
    }
  ) => {
    if (branchId && product.branchId && product.branchId !== branchId) {
      toast({
        variant: "destructive",
        title: "Producto de otra sucursal",
        description: "No puedes vender productos de una sucursal diferente.",
      });
      return;
    }

    const stock = toSafeNumber(product.stock, Number.NaN);
    const hasKnownStock = Number.isFinite(stock);
    const trackStock = product.trackStock !== false;

    if (trackStock && hasKnownStock && stock <= 0) {
      toast({
        title: "Sin stock",
        description: `No hay unidades disponibles de ${product.name}`,
        variant: "destructive",
      });
      return;
    }

    const step = getQuantityStep(product);
    const requestedQuantity =
      options?.quantity && options.quantity > 0
        ? roundTo(options.quantity, 3)
        : isWeighableProduct(product)
        ? step
        : 1;
    const normalizedBackendUnitPrice = toSafeNumber(
      options?.backendUnitPrice,
      NaN
    );
    const normalizedBackendSubtotal = toSafeNumber(
      options?.backendSubtotal,
      NaN
    );

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const nextQuantity = roundTo(existing.quantity + requestedQuantity, 3);
        if (trackStock && hasKnownStock && nextQuantity > stock) {
          toast({
            title: "Stock limitado",
            description: `Solo hay ${stock} disponibles de ${product.name}`,
            variant: "destructive",
          });
          return prev;
        }

        const nextBackendUnitPrice =
          Number.isFinite(normalizedBackendUnitPrice) &&
          existing.pricingMode === "AUTO"
            ? normalizedBackendUnitPrice
            : existing.backendUnitPrice;
        const nextBackendSubtotal =
          Number.isFinite(normalizedBackendSubtotal) &&
          existing.pricingMode === "AUTO"
            ? normalizedBackendSubtotal
            : Number.isFinite(toSafeNumber(nextBackendUnitPrice, NaN)) &&
              existing.pricingMode === "AUTO"
            ? roundTo(toSafeNumber(nextBackendUnitPrice, 0) * nextQuantity, 2)
            : existing.backendSubtotal;

        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                costPrice: toSafeNumber(product.costPrice, item.costPrice),
                wholesalePrice: toSafeNumber(
                  product.wholesalePrice,
                  item.wholesalePrice
                ),
                retailPrice: toSafeNumber(product.retailPrice, item.retailPrice),
                price: pickFirstFinite(
                  [product.retailPrice, product.wholesalePrice, product.costPrice],
                  item.price
                ),
                quantity: nextQuantity,
                visualPriceType:
                  options?.backendPriceType ?? item.visualPriceType,
                backendPriceType:
                  existing.pricingMode === "AUTO"
                    ? options?.backendPriceType ?? item.backendPriceType
                    : undefined,
                backendPricingSource:
                  existing.pricingMode === "AUTO"
                    ? options?.backendPricingSource ?? item.backendPricingSource
                    : undefined,
                backendUnitPrice:
                  existing.pricingMode === "AUTO"
                    ? nextBackendUnitPrice
                    : undefined,
                backendSubtotal:
                  existing.pricingMode === "AUTO"
                    ? nextBackendSubtotal
                    : undefined,
              }
            : item
        );
      }

      if (trackStock && hasKnownStock && requestedQuantity > stock) {
        toast({
          title: "Stock limitado",
          description: `Solo hay ${stock} disponibles de ${product.name}`,
          variant: "destructive",
        });
        return prev;
      }

      const backendUnitPrice = Number.isFinite(normalizedBackendUnitPrice)
        ? normalizedBackendUnitPrice
        : undefined;
      const backendSubtotal = Number.isFinite(normalizedBackendSubtotal)
        ? normalizedBackendSubtotal
        : undefined;

      return [
        ...prev,
        {
          ...product,
          quantity: requestedQuantity,
          pricingMode: "AUTO",
          requestedPriceType: undefined,
          manualOverrideReason: "",
          visualPriceType: options?.backendPriceType ?? "RETAIL",
          backendPriceType: options?.backendPriceType,
          backendPricingSource: options?.backendPricingSource,
          backendUnitPrice,
          backendSubtotal,
        },
      ];
    });
    setIsSaleCommitted(false);
  }, [branchId, toast]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    const inCart = cart.find((product) => product.id === id);
    const normalizedQuantity = roundTo(quantity, 3);
    const maxStock = pickFirstFinite([inCart?.stock], NaN);
    const hasReliableStockLimit =
      Number.isFinite(maxStock) && toSafeNumber(maxStock, 0) > 0;

    if (inCart && hasReliableStockLimit && normalizedQuantity > maxStock) {
      toast({
        title: "Stock insuficiente",
        description: `No puedes agregar mas de ${formatThresholdQuantity(
          maxStock
        )} ${getMeasurementLabel(inCart)}`,
        variant: "destructive",
      });
      return;
    }

    if (normalizedQuantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: normalizedQuantity,
            }
          : item
      )
    );
    setIsSaleCommitted(false);
  }, [cart, toast]);

  const commitManualQuantity = useCallback((item: CartItem, rawValue: string) => {
    const normalizedValue = rawValue.replace(",", ".").trim();
    if (!normalizedValue) return false;

    const parsedQuantity = Number(normalizedValue);
    if (!Number.isFinite(parsedQuantity)) {
      toast({
        variant: "destructive",
        title: "Cantidad invalida",
        description: "Ingresa una cantidad numerica valida.",
      });
      return false;
    }

    let resolvedQuantity = parsedQuantity;
    const inputHasDecimals = rawValue.includes(".") || rawValue.includes(",");
    const shouldInterpretAsGrams =
      item.measurementType === "kg" &&
      !inputHasDecimals &&
      Number.isInteger(parsedQuantity) &&
      parsedQuantity >= 100;

    if (shouldInterpretAsGrams) {
      resolvedQuantity = parsedQuantity / 1000;
    }

    updateQuantity(item.id, resolvedQuantity);
    return true;
  }, [toast, updateQuantity]);

  const updatePricingPreference = useCallback((
    id: string,
    selection: "AUTO" | "RETAIL" | "WHOLESALE"
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (selection === "AUTO") {
          return {
            ...item,
            pricingMode: "AUTO" as const,
            requestedPriceType: undefined,
            backendPriceType: undefined,
            backendPricingSource: undefined,
            backendUnitPrice: undefined,
            backendSubtotal: undefined,
          };
        }

        return {
          ...item,
          pricingMode: "MANUAL" as const,
          requestedPriceType: selection,
          visualPriceType: selection,
          backendPriceType: undefined,
          backendPricingSource: undefined,
          backendUnitPrice: undefined,
          backendSubtotal: undefined,
        };
      })
    );
    setIsSaleCommitted(false);
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    setIsSaleCommitted(false);
  }, []);

  const handleScanProduct = useCallback(async (code?: unknown) => {
    const normalizedCode = typeof code === "string" ? code.trim() : "";
    if (!normalizedCode) return false;
    if (!branchId) {
      toast({
        variant: "destructive",
        title: "Sucursal requerida",
        description: "Selecciona una sucursal activa antes de escanear.",
      });
      return false;
    }

    try {
      const cacheKey = `${branchId ?? "no-branch"}:${normalizedCode}`;
      const cached = scanCacheRef.current.get(cacheKey);
      const isCachedFresh =
        cached && Date.now() - cached.cachedAt < POS_SCAN_CACHE_TTL_MS;
      const resolved =
        isCachedFresh && cached
          ? cached.value
          : await backendApi.products.resolveBarcode(normalizedCode, {
              hydrateProductDetails: true,
              branchId,
            });
      const scanned = resolved?.product
        ? normalizeProductForPos(
            resolved.product as Product & { id: string; name: string }
          )
        : null;

      if (!scanned || !scanned.id) {
        toast({
          variant: "destructive",
          title: "Producto no encontrado",
          description: `No existe un producto para el codigo ${normalizedCode}.`,
        });
        return false;
      }

      scanCacheRef.current.set(cacheKey, {
        cachedAt: Date.now(),
        value: {
          ...resolved,
          product: scanned,
        },
      });

      addToCart(scanned as Product, {
        quantity: Number.isFinite(resolved.quantity ?? NaN)
          ? resolved.quantity
          : undefined,
        backendUnitPrice: Number.isFinite(resolved.unitPrice ?? NaN)
          ? resolved.unitPrice
          : undefined,
        backendSubtotal: Number.isFinite(resolved.subtotal ?? NaN)
          ? resolved.subtotal
          : undefined,
        backendPriceType: resolved.priceType,
        backendPricingSource: resolved.pricingSource,
      });
      return true;
    } catch (error: unknown) {
      const message = getErrorMessage(error, "");
      const normalizedMessage = message.toLowerCase();
      const isInvalidBarcode =
        normalizedMessage.includes("barcode invalido") ||
        normalizedMessage.includes("invalid barcode") ||
        normalizedMessage.includes("ean");
      const isMissingPlu =
        normalizedMessage.includes("plu") &&
        (normalizedMessage.includes("inexistente") ||
          normalizedMessage.includes("not found"));

      toast({
        variant: "destructive",
        title: "Error al escanear",
        description: isInvalidBarcode
          ? "El codigo escaneado no es valido."
          : isMissingPlu
          ? "El PLU del codigo interno no existe en el catalogo."
          : getErrorMessage(error, "No se pudo procesar el codigo escaneado."),
      });
      return false;
    }
  }, [branchId, addToCart, toast]);

  const itemCount = cart.length;
  const previewBranchName =
    branches.find((branch) => branch.id === branchId)?.name ?? "Sucursal actual";
  const previewCashierName =
    currentUser?.name ?? currentUser?.email ?? "Usuario actual";
  const {
    total,
    totalInitialPayments,
    pendingAfterInitialPayments,
    changeDuePreview,
    paymentPreviewRows,
    previewItems,
    previewTotalUnits,
  } = useMemo(() => {
    const nextTotal = cart.reduce((sum, item) => sum + getCartLineTotal(item), 0);
    const cashPaymentPreview = Math.max(0, parseMoneyInput(cashPaymentAmount));
    const transferPaymentPreview = Math.max(
      0,
      parseMoneyInput(transferPaymentAmount)
    );
    const nextTotalInitialPayments =
      cashPaymentPreview + transferPaymentPreview;
    const nextPaymentPreviewRows: PaymentPreviewRow[] = [];

    if (Number.isFinite(cashPaymentPreview) && cashPaymentPreview > 0) {
      nextPaymentPreviewRows.push({
        method: "CASH",
        amount: cashPaymentPreview,
      });
    }
    if (
      Number.isFinite(transferPaymentPreview) &&
      transferPaymentPreview > 0
    ) {
      nextPaymentPreviewRows.push({
        method: "TRANSFER",
        amount: transferPaymentPreview,
        reference: transferReference.trim() || undefined,
      });
    }

    const nextPreviewItems: PosPreviewItem[] = cart.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: toSafeNumber(item.quantity, 0),
      measurementType: item.measurementType,
      lineTotal: roundTo(getCartLineTotal(item), 2),
      unitPrice: roundTo(getDisplayUnitPrice(item), 2),
      priceType: getDisplayPriceType(item),
      pricingMode: item.pricingMode,
    }));

    return {
      total: nextTotal,
      totalInitialPayments: nextTotalInitialPayments,
      pendingAfterInitialPayments: Math.max(
        0,
        nextTotal - nextTotalInitialPayments
      ),
      changeDuePreview: Math.max(
        0,
        nextTotalInitialPayments - nextTotal
      ),
      paymentPreviewRows: nextPaymentPreviewRows,
      previewItems: nextPreviewItems,
      previewTotalUnits: nextPreviewItems.reduce(
        (sum, item) => sum + toSafeNumber(item.quantity, 0),
        0
      ),
    };
  }, [cart, cashPaymentAmount, transferPaymentAmount, transferReference]);

  const ensureOpenCashSession = async () => {
    if (!canManageCash) return true;

    if (!branchId) {
      toast({
        variant: "destructive",
        title: "Sucursal requerida",
        description: "Selecciona una sucursal para validar el estado de caja.",
      });
      return false;
    }

    try {
      const summary = await backendApi.cash.getCurrentSummary(branchId);
      if (summary.hasOpenSession) return true;
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error de caja",
        description: getErrorMessage(
          error,
          "No se pudo validar el estado actual de caja."
        ),
      });
      return false;
    }

    toast({
      variant: "destructive",
      title: "Caja cerrada",
      description: "Debes abrir caja antes de registrar ventas.",
    });
    return false;
  };

  const handlePayment = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrito vacio",
        description: "Agrega productos al carrito antes de procesar el pago",
        variant: "destructive",
      });
      return;
    }

    if (isSaleCommitted) {
      clearCart();
      return;
    }

    const canProceed = await ensureOpenCashSession();
    if (!canProceed) return;

    setIsPaymentConfirmOpen(true);
  };

  const processPayment = async () => {
    const saleBranchId = branchId;
    let rollbackState: {
      cart: CartItem[];
      cashPaymentAmount: string;
      transferPaymentAmount: string;
      transferReference: string;
    } | null = null;

    try {
      if (!saleBranchId) {
        toast({
          variant: "destructive",
          title: "Sucursal requerida",
          description: "Selecciona una sucursal para registrar la venta.",
        });
        return;
      }

      const invalidItems = cart.filter(
        (item) => item.branchId && item.branchId !== saleBranchId
      );
      if (invalidItems.length > 0) {
        toast({
          variant: "destructive",
          title: "Productos de otra sucursal",
          description:
            "Hay productos del carrito que no pertenecen a la sucursal activa.",
        });
        return;
      }

      const invalidManualItems = cart.filter(
        (item) => item.pricingMode === "MANUAL" && !item.requestedPriceType
      );
      if (invalidManualItems.length > 0) {
        toast({
          variant: "destructive",
          title: "Configuracion de precio invalida",
          description:
            "Cada item manual debe tener seleccionado Por menor o Por mayor.",
        });
        return;
      }

      setIsProcessingPayment(true);
      const payments: Array<{
        amount: number;
        method: PaymentMethod;
        reference?: string;
      }> = [];
      const cashAmount = parseMoneyInput(cashPaymentAmount);
      const transferAmount = parseMoneyInput(transferPaymentAmount);
      if (Number.isFinite(cashAmount) && cashAmount > 0) {
        payments.push({ amount: cashAmount, method: "CASH" });
      }
      if (Number.isFinite(transferAmount) && transferAmount > 0) {
        payments.push({
          amount: transferAmount,
          method: "TRANSFER",
          reference: transferReference.trim() || undefined,
        });
      }

      const cartSnapshot = [...cart];
      rollbackState = {
        cart: cartSnapshot,
        cashPaymentAmount,
        transferPaymentAmount,
        transferReference,
      };

      setIsPaymentConfirmOpen(false);
      clearCart({ silent: true });

      const createdSale = await backendApi.sales.create({
        branchId: saleBranchId,
        items: cartSnapshot.map((item) => {
          const quantity = toSafeNumber(item.quantity, 0);

          return {
            productId: item.id,
            quantity,
            pricingMode: item.pricingMode,
            requestedPriceType:
              item.pricingMode === "MANUAL"
                ? item.requestedPriceType
                : undefined,
            manualOverrideReason:
              item.pricingMode === "MANUAL"
                ? item.manualOverrideReason?.trim() || undefined
                : undefined,
          };
        }),
        payments,
      });

      const paidAmount = Number(createdSale.paidAmount ?? 0);
      const outstandingAmount = Number(createdSale.outstandingAmount ?? 0);
      const backendTotal = Number(createdSale.totalAmount ?? total);
      const localChangeDue = Math.max(0, totalInitialPayments - backendTotal);
      toast({
        title: "Venta registrada",
        description:
          outstandingAmount > 0
            ? `Total $${formatMoney(backendTotal)}. Cobrado $${formatMoney(
                paidAmount
              )}. Saldo pendiente $${formatMoney(outstandingAmount)}.`
            : localChangeDue > 0
            ? `Total $${formatMoney(
                backendTotal
              )}. Vuelto sugerido $${formatMoney(localChangeDue)}.`
            : `Total $${formatMoney(backendTotal)} registrado correctamente.`,
      });
      scanCacheRef.current.clear();
      setSearchRefreshTick((current) => current + 1);
      emitProductsSync(saleBranchId);
    } catch (error: unknown) {
      if (rollbackState) {
        setCart(rollbackState.cart);
        setCashPaymentAmount(rollbackState.cashPaymentAmount);
        setTransferPaymentAmount(rollbackState.transferPaymentAmount);
        setTransferReference(rollbackState.transferReference);
        setIsPaymentConfirmOpen(true);
      }
      toast({
        variant: "destructive",
        title: "Error al registrar venta",
        description: getErrorMessage(
          error,
          "No se pudo registrar la venta."
        ),
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const clearCart = (options?: { silent?: boolean }) => {
    setCart([]);
    setIsSaleCommitted(false);
    setCashPaymentAmount("");
    setTransferPaymentAmount("");
    setTransferReference("");
    if (!options?.silent) {
      toast({
        title: "Carrito vaciado",
        description: "Se quitaron todos los productos del carrito.",
      });
    }
  };

  const handleSelectSearchProduct = useCallback(async (product: Product) => {
    if (isSaleCommitted) return false;
    const preparedProduct = normalizeProductForPos({
      ...product,
      branchId: product.branchId ?? branchId ?? null,
    });
    addToCart(preparedProduct);
    return true;
  }, [isSaleCommitted, addToCart, branchId]);

  const searchQuery = "";
  const scanQuery = "";
  const searchSuggestions: Product[] = [];
  const isSearchLoading = false;
  const canSearch = false;
  const shouldShowSearchDropdown = false;
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const setSearchQuery: (value: string) => void = () => {};
  const setScanQuery: (value: string) => void = () => {};
  const setIsSearchDropdownOpen: (open: boolean) => void = () => {};
  const useOptimizedPosView = process.env.NODE_ENV !== "__legacy_pos__";

  if (useOptimizedPosView) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Punto de Venta
            </h1>
            <p className="text-muted-foreground">
              Flujo rapido para caja y mostrador
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <PosCatalogCard
              key={branchId ?? "no-branch"}
              branchId={branchId}
              branchName={previewBranchName}
              cart={cart}
              itemCount={itemCount}
              isSaleCommitted={isSaleCommitted}
              isPaymentConfirmOpen={isPaymentConfirmOpen}
              searchRefreshTick={searchRefreshTick}
              onScanCode={handleScanProduct}
              onSelectSearchProduct={handleSelectSearchProduct}
              onUpdatePricingPreference={updatePricingPreference}
              onUpdateQuantity={updateQuantity}
              onCommitManualQuantity={commitManualQuantity}
              onRemoveFromCart={removeFromCart}
            />
          </div>

          <div className="space-y-4">
            <PosPaymentCard
              cartLength={cart.length}
              itemCount={itemCount}
              total={total}
              totalInitialPayments={totalInitialPayments}
              changeDuePreview={changeDuePreview}
              cashPaymentAmount={cashPaymentAmount}
              transferPaymentAmount={transferPaymentAmount}
              onCashPaymentAmountChange={handleCashPaymentAmountChange}
              onTransferPaymentAmountChange={handleTransferPaymentAmountChange}
              onCashPaymentAmountBlur={handleCashPaymentAmountBlur}
              onTransferPaymentAmountBlur={handleTransferPaymentAmountBlur}
              onHandlePayment={handlePayment}
              onClearCart={() => clearCart()}
              isProcessingPayment={isProcessingPayment}
              isSaleCommitted={isSaleCommitted}
            />
          </div>
        </div>

        <PosPaymentConfirmDialog
          open={isPaymentConfirmOpen}
          onOpenChange={setIsPaymentConfirmOpen}
          isProcessingPayment={isProcessingPayment}
          total={total}
          totalInitialPayments={totalInitialPayments}
          itemCount={itemCount}
          changeDuePreview={changeDuePreview}
          pendingAfterInitialPayments={pendingAfterInitialPayments}
          previewItems={previewItems}
          previewTotalUnits={previewTotalUnits}
          previewBranchName={previewBranchName}
          previewCashierName={previewCashierName}
          paymentPreviewRows={paymentPreviewRows}
          onProcessPayment={processPayment}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Punto de Venta
          </h1>
          <p className="text-muted-foreground">
            Flujo rapido para caja y mostrador
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={scanInputRef}
                      autoFocus
                      placeholder="Escanear o escribir codigo de barras"
                      value={scanQuery}
                      onChange={(event) => setScanQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleScanProduct();
                        }
                      }}
                      className="pl-8"
                      disabled={isSaleCommitted}
                    />
                  </div>
                  <Button
                    onClick={handleScanProduct}
                    disabled={isSaleCommitted}
                  >
                    Agregar
                  </Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchQuery}
                      onFocus={() => setIsSearchDropdownOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setIsSearchDropdownOpen(false);
                        }, 120);
                      }}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setIsSearchDropdownOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setIsSearchDropdownOpen(false);
                          return;
                        }

                        if (
                          event.key === "Enter" &&
                          searchSuggestions.length > 0 &&
                          !isSearchLoading
                        ) {
                          event.preventDefault();
                          void handleSelectSearchProduct(searchSuggestions[0]);
                        }
                      }}
                      className="pl-8"
                    />
                    {shouldShowSearchDropdown ? (
                      <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-xl">
                        {!canSearch ? (
                          <p className="px-3 py-3 text-sm text-muted-foreground">
                            Escribe al menos {POS_MIN_SEARCH_LENGTH} caracteres.
                          </p>
                        ) : isSearchLoading ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando productos...
                          </div>
                        ) : searchSuggestions.length > 0 ? (
                          <div className="max-h-80 overflow-y-auto p-1">
                            {searchSuggestions.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  void handleSelectSearchProduct(product);
                                }}
                              >
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60">
                                  <img
                                    src={resolveProductImageUrl(product)}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.src =
                                        "/placeholder.svg";
                                    }}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">
                                    {product.name}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {getProductSearchMetaLabel(product)}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`h-5 min-w-[76px] justify-center px-2 text-[10px] font-black uppercase ${getStockBadgeClassName(
                                      product
                                    )}`}
                                  >
                                    {getStockBadgeLabel(product)}
                                  </Badge>
                                  <span className="text-xs font-bold text-primary">
                                    ${formatMoney(getRetailPrice(product))}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-3 text-sm text-muted-foreground">
                            No se encontraron productos para: {searchQuery}.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sucursal activa:{" "}
                  <span className="font-semibold text-foreground">
                    {branches.find((branch) => branch.id === branchId)?.name ??
                      "Sin sucursal"}
                  </span>
                </p>
              </div>
            </CardHeader>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>Productos agregados</span>
                <Badge variant="secondary">{itemCount} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 px-6 py-10 text-center">
                  <Image
                    src="/emptystate.png"
                    alt="Empty state POS"
                    width={360}
                    height={360}
                    className="mb-5 h-44 w-auto max-w-[88%] object-contain drop-shadow-sm"
                    priority
                  />
                  <p className="text-sm font-semibold text-foreground">
                    No hay productos agregados
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Busca o escanea articulos para comenzar una venta y verlos
                    aqui.
                  </p>
                </div>
              ) : (
                <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border bg-card p-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted ring-1 ring-border/60">
                          <img
                            src={resolveProductImageUrl(item)}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="truncate text-sm font-medium">
                              {item.name}
                            </h4>
                            <p className="whitespace-nowrap text-xs font-semibold">
                              Subtotal: $
                              {roundTo(getCartLineTotal(item), 2).toFixed(2)}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            $
                            {toSafeNumber(getDisplayUnitPrice(item), 0).toFixed(
                              2
                            )}{" "}
                            /{" "}
                            {item.measurementType === "kg"
                              ? "kg"
                              : item.measurementType === "gram"
                              ? "gr"
                              : "unidad"}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <Badge
                              variant="outline"
                              className="h-5 text-[10px]"
                            >
                              {getPriceTypeLabel(getDisplayPriceType(item))}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`h-5 text-[10px] ${getStockBadgeClassName(
                                item
                              )}`}
                            >
                              {getStockBadgeLabel(item)}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={
                                selectorValueFromItem(item) === "AUTO"
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 px-2 text-[10px]"
                              disabled={isSaleCommitted}
                              onClick={() =>
                                updatePricingPreference(item.id, "AUTO")
                              }
                            >
                              Automatico
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                selectorValueFromItem(item) === "RETAIL"
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 px-2 text-[10px]"
                              disabled={isSaleCommitted}
                              onClick={() =>
                                updatePricingPreference(item.id, "RETAIL")
                              }
                            >
                              Por menor
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                selectorValueFromItem(item) === "WHOLESALE"
                                  ? "default"
                                  : "outline"
                              }
                              className="h-7 px-2 text-[10px]"
                              disabled={isSaleCommitted}
                              onClick={() =>
                                updatePricingPreference(item.id, "WHOLESALE")
                              }
                            >
                              Por mayor
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                roundTo(
                                  item.quantity - getQuantityStep(item),
                                  3
                                )
                              )
                            }
                            disabled={isSaleCommitted}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          {isWeighableProduct(item) ? (
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={getQuantityStep(item)}
                              step={getQuantityStep(item)}
                              defaultValue={formatThresholdQuantity(
                                toSafeNumber(item.quantity, 0)
                              )}
                              key={`${item.id}-${item.quantity}`}
                              className="h-8 w-24 text-center text-sm"
                              placeholder={
                                item.measurementType === "kg"
                                  ? "kg o gramos"
                                  : "Cantidad"
                              }
                              title={
                                item.measurementType === "kg"
                                  ? "Puedes ingresar kg (ej. 1.5) o gramos enteros (ej. 1500)."
                                  : undefined
                              }
                              disabled={isSaleCommitted}
                              onBlur={(event) => {
                                const committed = commitManualQuantity(
                                  item,
                                  event.target.value
                                );
                                if (!committed) {
                                  event.target.value = formatThresholdQuantity(
                                    toSafeNumber(item.quantity, 0)
                                  );
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  const committed = commitManualQuantity(
                                    item,
                                    event.currentTarget.value
                                  );
                                  if (!committed) {
                                    event.currentTarget.value =
                                      formatThresholdQuantity(
                                        toSafeNumber(item.quantity, 0)
                                      );
                                  }
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                          ) : (
                            <span className="w-10 text-center text-sm">
                              {Math.trunc(item.quantity)}
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                roundTo(
                                  item.quantity + getQuantityStep(item),
                                  3
                                )
                              )
                            }
                            disabled={isSaleCommitted}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
                          disabled={isSaleCommitted}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pagar</span>
                <Badge variant="secondary">{itemCount} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${formatMoney(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pagos iniciales:</span>
                <span>${formatMoney(totalInitialPayments)}</span>
              </div>
              {changeDuePreview > 0 && (
                <div className="flex justify-between text-sm font-semibold text-emerald-700">
                  <span>Vuelto a entregar:</span>
                  <span>${formatMoney(changeDuePreview)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>${formatMoney(total)}</span>
              </div>
            </div>
              <div className="space-y-2">
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Pagos
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-md font-bold text-muted-foreground">
                        Efectivo
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={cashPaymentAmount}
                        onChange={(event) =>
                          handleCashPaymentAmountChange(event.target.value)
                        }
                        onBlur={handleCashPaymentAmountBlur}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-md font-bold text-muted-foreground">
                        Transferencia
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={transferPaymentAmount}
                        onChange={(event) =>
                          handleTransferPaymentAmountChange(event.target.value)
                        }
                        onBlur={handleTransferPaymentAmountBlur}
                        className="h-10"
                      />
                    </div>
                  </div>
                </div>
                {cart.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Agrega productos para habilitar el cobro.
                  </p>
                ) : null}
                <Button
                  className="w-full"
                  onClick={() => handlePayment()}
                  disabled={isProcessingPayment || cart.length === 0}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  {isSaleCommitted ? "Nueva venta" : "Registrar Venta"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full"
                      variant="ghost"
                      disabled={cart.length === 0}
                    >
                      Limpiar Carrito
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpiar el carrito?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se quitaran todos los productos seleccionados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          clearCart();
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Limpiar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={isPaymentConfirmOpen}
        onOpenChange={(open) => {
          if (isProcessingPayment) return;
          setIsPaymentConfirmOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[min(96vw,1120px)] max-w-5xl flex-col gap-0 overflow-hidden border-0 bg-background p-0 shadow-2xl sm:max-h-[90vh]">
          <div className="shrink-0 border-b bg-gradient-to-br from-[#E74E7F]/10 via-background to-[#E74E7F]/5 p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <Badge className="rounded-full bg-[#E74E7F]/70 px-3 py-1 text-xs font-semibold text-white hover:bg-[#E74E7F]/70">
                  Confirmacion previa
                </Badge>
                <DialogHeader className="mt-4 text-left">
                  <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight sm:text-3xl">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E74E7F]/15 text-[#E74E7F]">
                      <ReceiptText className="h-6 w-6" />
                    </span>
                    Confirmar venta
                  </DialogTitle>
                  <DialogDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    Revisa el detalle, los pagos cargados y el importe a
                    devolver antes de registrar definitivamente la venta.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Total
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-tight">
                      ${formatMoney(total)}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Cobrado
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-tight">
                      ${formatMoney(totalInitialPayments)}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Items
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-tight">
                      {itemCount}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatThresholdQuantity(previewTotalUnits)} unidades
                      totales
                    </p>
                  </div>
                </div>
              </div>

              <div className="xl:w-[310px]">
                <div className="rounded-[28px] border border-[#E74E7F]/25 bg-[#E74E7F]/70 p-5 text-white shadow-xl shadow-[#E74E7F]/20 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">
                    {changeDuePreview > 0
                      ? "Vuelto a entregar"
                      : pendingAfterInitialPayments > 0
                      ? "Saldo pendiente"
                      : "Pago exacto"}
                  </p>
                  <p className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                    $
                    {formatMoney(
                      changeDuePreview > 0
                        ? changeDuePreview
                        : pendingAfterInitialPayments > 0
                        ? pendingAfterInitialPayments
                        : 0
                    )}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/90">
                    {changeDuePreview > 0
                      ? "Este es el importe que deberias devolver al cliente al cerrar la operacion."
                      : pendingAfterInitialPayments > 0
                      ? "La venta se registrara con saldo pendiente si continuas."
                      : "El importe cargado coincide exactamente con el total."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 sm:p-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Detalle vendido
                </h3>
              </div>

              <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1 sm:max-h-[38vh]">
                {previewItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {item.name}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[11px]">
                            {formatThresholdQuantity(item.quantity)}{" "}
                            {item.measurementType === "kg"
                              ? "kg"
                              : item.measurementType === "gram"
                              ? "gr"
                              : "un"}
                          </Badge>
                          <Badge variant="outline" className="text-[11px]">
                            {getPriceTypeLabel(item.priceType)}
                          </Badge>
                          {item.pricingMode === "MANUAL" ? (
                            <Badge className="bg-[#E74E7F]/15 text-[11px] font-semibold text-[#C43C69] hover:bg-[#E74E7F]/15">
                              Manual
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black">
                          ${formatMoney(item.lineTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${formatMoney(item.unitPrice)} c/u
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-muted/20 p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Datos de la operacion
                  </h3>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Sucursal</span>
                    <span className="text-right font-semibold">
                      {previewBranchName}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Cajero</span>
                    <span className="text-right font-semibold">
                      {previewCashierName}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Productos</span>
                    <span className="text-right font-semibold">
                      {itemCount}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Unidades</span>
                    <span className="text-right font-semibold">
                      {formatThresholdQuantity(previewTotalUnits)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Pagos cargados
                </h3>
                <div className="mt-4 space-y-3">
                  {paymentPreviewRows.length > 0 ? (
                    paymentPreviewRows.map((payment, index) => (
                      <div
                        key={`${payment.method}-${index}`}
                        className="rounded-xl border bg-muted/20 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              {getPaymentMethodLabel(payment.method)}
                            </p>
                            {payment.reference ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Ref: {payment.reference}
                              </p>
                            ) : null}
                          </div>
                          <p className="text-sm font-black">
                            ${formatMoney(payment.amount)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cargaste pagos iniciales. La venta se registrara con
                      saldo pendiente.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Totales
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Total venta</span>
                    <span className="font-semibold">${formatMoney(total)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Cobrado</span>
                    <span className="font-semibold">
                      ${formatMoney(totalInitialPayments)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Pendiente</span>
                    <span className="font-semibold">
                      ${formatMoney(pendingAfterInitialPayments)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between gap-3 text-base font-black">
                    <span>
                      {changeDuePreview > 0
                        ? "Vuelto"
                        : pendingAfterInitialPayments > 0
                        ? "Saldo"
                        : "Diferencia"}
                    </span>
                    <span>
                      $
                      {formatMoney(
                        changeDuePreview > 0
                          ? changeDuePreview
                          : pendingAfterInitialPayments > 0
                          ? pendingAfterInitialPayments
                          : 0
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0 sm:px-6">
            <p className="text-sm text-muted-foreground">
              Si todo esta correcto, confirma para registrar la venta.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setIsPaymentConfirmOpen(false)}
                disabled={isProcessingPayment}
              >
                Volver
              </Button>
              <Button
                onClick={processPayment}
                className="min-w-[220px]"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirmar y Registrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

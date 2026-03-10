"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

import { useTransactions } from "@/components/providers/transactions-provider";
import { useUser } from "@/components/providers/user-provider";
import { Product } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { backendApi } from "@/lib/backend-api";
import { emitProductsSync } from "@/lib/products-live-sync";
import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";
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

type Category = {
  id: string;
  name: string;
};

const POS_CART_STORAGE_PREFIX = "bms:pos-cart:v1";
const POS_CART_TTL_MS = 12 * 60 * 60 * 1000;

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

function getDisplayUnitPrice(item: CartItem): number {
  const backendUnitPrice = toSafeNumber(item.backendUnitPrice, NaN);
  if (Number.isFinite(backendUnitPrice) && backendUnitPrice > 0) {
    return backendUnitPrice;
  }
  return getEstimatedUnitPrice(item);
}

function getDisplayPriceType(item: CartItem): PriceType {
  return item.backendPriceType ?? getRequestedOrDefaultPriceType(item);
}

function getDisplayPricingSource(item: CartItem): PricingMode {
  return item.backendPricingSource ?? item.pricingMode;
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

function formatThresholdQuantity(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3).replace(/\.?0+$/, "");
}

function getMeasurementLabel(product: Product) {
  if (product.measurementType === "kg") return "kg";
  if (product.measurementType === "gram") return "gr";
  return "unidades";
}

// function getAutoRuleLabel(item: CartItem): string | null {
//   const threshold = getWholesaleMinQuantity(item);
//   if (threshold === null) return null;
//   return `Auto: minorista hasta ${formatThresholdQuantity(
//     threshold
//   )} ${getMeasurementLabel(item)} y mayorista por encima.`;
// }

export function POSModule() {
  const { addSale } = useTransactions();
  const { currentUser, branchId, branches } = useUser();
  const { toast } = useToast();

  const canManageCash =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "cashier" ||
    currentUser?.role === "seller";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [cashPaymentAmount, setCashPaymentAmount] = useState("");
  const [transferPaymentAmount, setTransferPaymentAmount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSaleCommitted, setIsSaleCommitted] = useState(false);
  const previousBranchRef = useRef<string | null>(null);
  const cartPersistenceReadyRef = useRef(false);
  const posCartStorageKey = useMemo(
    () => buildPosCartStorageKey(currentUser?.id ?? null, branchId ?? null),
    [currentUser?.id, branchId]
  );

  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const {
    products,
    total: productsTotal,
    hasMore,
    skip,
    take,
    isLoading,
    mutateProducts,
  } = useProducts({
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    branchId: branchId ?? null,
    resolveStockFromStocksEndpoint: true,
  });
  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    (categoriesData ?? []).forEach((category) => {
      if (category?.id && category?.name) map.set(category.id, category.name);
    });
    return map;
  }, [categoriesData]);

  const moneyFormatter = useMemo(() => new Intl.NumberFormat("es-AR"), []);

  const formatMoney = (value: unknown) =>
    moneyFormatter.format(toSafeNumber(value, 0));

  const isWeighableProduct = (product: Product) =>
    Boolean(product.isWeighable) ||
    product.measurementType === "kg" ||
    product.measurementType === "gram";

  const getQuantityStep = (product: Product) => {
    if (product.measurementType === "kg") return 0.001;
    if (product.measurementType === "gram") return 1;
    return 1;
  };

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
    if (cart.length === 0 || products.length === 0) return;

    const productById = new Map(
      products.map((product) => [product.id, product])
    );
    setCart((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const latest = productById.get(item.id);
        if (!latest) return item;

        const merged: CartItem = {
          ...latest,
          quantity: item.quantity,
          pricingMode: item.pricingMode,
          requestedPriceType: item.requestedPriceType,
          manualOverrideReason: item.manualOverrideReason,
          visualPriceType: item.visualPriceType,
          backendPriceType: item.backendPriceType,
          backendPricingSource: item.backendPricingSource,
          backendUnitPrice: item.backendUnitPrice,
          backendSubtotal: item.backendSubtotal,
          backendBaseRetailPrice: item.backendBaseRetailPrice,
          backendBaseWholesalePrice: item.backendBaseWholesalePrice,
          backendPricingRuleSnapshot: item.backendPricingRuleSnapshot,
          backendManualOverrideReason: item.backendManualOverrideReason,
        };

        const sameSnapshot =
          merged.stock === item.stock &&
          merged.costPrice === item.costPrice &&
          merged.retailPrice === item.retailPrice &&
          merged.wholesalePrice === item.wholesalePrice &&
          merged.branchId === item.branchId &&
          merged.updatedAt === item.updatedAt;

        if (sameSnapshot) return item;
        changed = true;
        return merged;
      });

      return changed ? next : prev;
    });
  }, [products, cart.length]);

  useEffect(() => {
    if (!branchId) {
      previousBranchRef.current = null;
      return;
    }

    if (previousBranchRef.current === null) {
      previousBranchRef.current = branchId;
      return;
    }

    if (previousBranchRef.current !== branchId && cart.length > 0) {
      setCart([]);
      setIsSaleCommitted(false);
      toast({
        title: "Sucursal cambiada",
        description:
          "Se limpio el carrito para evitar mezclar productos entre sucursales.",
      });
    }

    if (previousBranchRef.current !== branchId) {
      setCurrentPage(1);
    }

    previousBranchRef.current = branchId;
  }, [branchId, cart.length, toast]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);
  const searchSuggestions = useMemo(
    () => filteredProducts.slice(0, 8),
    [filteredProducts]
  );
  const shouldShowSearchDropdown =
    isSearchDropdownOpen && searchQuery.trim().length > 0;

  const getProductCategoryLabel = (product: Product) => {
    if (product.categoryId) {
      return categoryNameById.get(product.categoryId) ?? product.categoryId;
    }

    return getLooseCategoryLabel(
      (product as Product & { category?: unknown }).category
    );
  };

  const getStockBadgeClassName = (product: Product) => {
    const stock = Number(product.stock ?? 0);
    const minStock = Number(product.minStock ?? 0);

    if (stock <= minStock) {
      return "border-red-300 bg-red-50 text-red-700";
    }

    const warningThreshold = minStock > 0 ? Math.ceil(minStock * 1.5) : 3;
    if (stock <= warningThreshold) {
      return "border-yellow-300 bg-yellow-50 text-yellow-700";
    }

    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  };

  const categories = useMemo(
    () =>
      (categoriesData ?? [])
        .filter((category) => Boolean(category?.id) && Boolean(category?.name))
        .map((category) => ({
          value: category.id,
          label: category.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categoriesData]
  );

  const addToCart = (product: Product, options?: { quantity?: number }) => {
    if (branchId && product.branchId && product.branchId !== branchId) {
      toast({
        variant: "destructive",
        title: "Producto de otra sucursal",
        description: "No puedes vender productos de una sucursal diferente.",
      });
      return;
    }

    const stock = Number(product.stock ?? 0);
    if (stock <= 0) {
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

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const nextQuantity = roundTo(existing.quantity + requestedQuantity, 3);
        if (nextQuantity > stock) {
          toast({
            title: "Stock limitado",
            description: `Solo hay ${stock} disponibles de ${product.name}`,
            variant: "destructive",
          });
          return prev;
        }

        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: nextQuantity } : item
        );
      }

      if (requestedQuantity > stock) {
        toast({
          title: "Stock limitado",
          description: `Solo hay ${stock} disponibles de ${product.name}`,
          variant: "destructive",
        });
        return prev;
      }

      return [
        ...prev,
        {
          ...product,
          quantity: requestedQuantity,
          pricingMode: "AUTO",
          requestedPriceType: undefined,
          manualOverrideReason: "",
          visualPriceType: "RETAIL",
        },
      ];
    });
    setIsSaleCommitted(false);
  };

  const updateQuantity = (id: string, quantity: number) => {
    const inCart = cart.find((product) => product.id === id);
    const normalizedQuantity = roundTo(quantity, 3);
    const stockFromProductsList = products.find(
      (product) => product.id === id
    )?.stock;
    const maxStock = pickFirstFinite(
      [inCart?.stock, stockFromProductsList],
      NaN
    );
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
  };

  const updatePricingPreference = (
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
          };
        }

        return {
          ...item,
          pricingMode: "MANUAL" as const,
          requestedPriceType: selection,
        };
      })
    );
    setIsSaleCommitted(false);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    setIsSaleCommitted(false);
  };

  const handleScanProduct = async () => {
    const code = scanQuery.trim();
    if (!code) return;

    try {
      const localMatch =
        products.find(
          (product) =>
            product.barcode === code ||
            product.sku === code ||
            product.pluCode === code
        ) ?? null;

      const resolved = localMatch
        ? {
            product: localMatch,
            quantity: undefined,
            unitPrice: undefined,
            subtotal: undefined,
            barcodeType: "STANDARD",
          }
        : await backendApi.products.resolveBarcode(code);
      const scanned = resolved?.product ?? null;

      if (!scanned || !scanned.id) {
        toast({
          variant: "destructive",
          title: "Producto no encontrado",
          description: `No existe un producto para el codigo ${code}.`,
        });
        return;
      }

      addToCart(scanned as Product, {
        quantity: Number.isFinite(resolved.quantity ?? NaN)
          ? resolved.quantity
          : undefined,
      });
      setSearchQuery(scanned.name);
      setScanQuery("");
    } catch (error: any) {
      const message = String(error?.message ?? "");
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
          : error?.message || "No se pudo procesar el codigo escaneado.",
      });
    }
  };

  const getCartLineTotal = (item: CartItem) => {
    const backendSubtotal = toSafeNumber(item.backendSubtotal, NaN);
    if (Number.isFinite(backendSubtotal) && backendSubtotal >= 0) {
      return backendSubtotal;
    }
    return getDisplayUnitPrice(item) * toSafeNumber(item.quantity, 0);
  };

  const total = cart.reduce((sum, item) => sum + getCartLineTotal(item), 0);
  const itemCount = cart.length;
  const cashPaymentPreview = Math.max(0, Number(cashPaymentAmount || 0));
  const transferPaymentPreview = Math.max(
    0,
    Number(transferPaymentAmount || 0)
  );
  const totalInitialPayments = cashPaymentPreview + transferPaymentPreview;
  const pendingAfterInitialPayments = Math.max(0, total - totalInitialPayments);
  const changeDuePreview = Math.max(0, totalInitialPayments - total);
  const totalPages = Math.max(
    1,
    Math.ceil((productsTotal || 0) / Math.max(take, 1))
  );
  const showingFrom = productsTotal === 0 ? 0 : skip + 1;
  const showingTo = productsTotal === 0 ? 0 : skip + filteredProducts.length;

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
      const session = await backendApi.cash.getCurrentSession();
      if (session) return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de caja",
        description:
          error?.message || "No se pudo validar el estado actual de caja.",
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
      const cashAmount = Number(cashPaymentAmount || 0);
      const transferAmount = Number(transferPaymentAmount || 0);
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

      const createdSale = await addSale({
        customerName: "Consumidor Final",
        lineItems: cartSnapshot.map((item) => {
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
        branchId: saleBranchId,
      });

      const paidAmount = Number(createdSale.paidAmount ?? 0);
      const outstandingAmount = Number(createdSale.outstandingAmount ?? 0);
      const backendTotal = Number(createdSale.totalAmount ?? total);
      const localChangeDue = Math.max(0, totalInitialPayments - backendTotal);

      toast({
        title: "Venta exitosa",
        description:
          outstandingAmount > 0
            ? `Venta por $${formatMoney(
                backendTotal
              )} registrada. Pagado: $${formatMoney(
                paidAmount
              )}. Saldo pendiente: $${formatMoney(outstandingAmount)}.`
            : localChangeDue > 0
            ? `Venta por $${formatMoney(
                backendTotal
              )} registrada y pagada. Vuelto sugerido: $${formatMoney(
                localChangeDue
              )}.`
            : `Venta por $${formatMoney(backendTotal)} registrada y pagada.`,
      });
      await mutateProducts();
      emitProductsSync(saleBranchId);
    } catch (error: any) {
      if (rollbackState) {
        setCart(rollbackState.cart);
        setCashPaymentAmount(rollbackState.cashPaymentAmount);
        setTransferPaymentAmount(rollbackState.transferPaymentAmount);
        setTransferReference(rollbackState.transferReference);
      }
      toast({
        variant: "destructive",
        title: "Error al registrar venta",
        description: error?.message || "No se pudo registrar la venta.",
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

  const handleSelectSearchProduct = (product: Product) => {
    if (isSaleCommitted) return;
    addToCart(product);
    setSearchQuery("");
    setCurrentPage(1);
    setIsSearchDropdownOpen(false);
  };

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
                        setCurrentPage(1);
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
                          !isLoading
                        ) {
                          event.preventDefault();
                          handleSelectSearchProduct(searchSuggestions[0]);
                        }
                      }}
                      className="pl-8"
                    />
                    {shouldShowSearchDropdown ? (
                      <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-xl">
                        {isLoading ? (
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
                                onClick={() => handleSelectSearchProduct(product)}
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
                                    {getProductCategoryLabel(product)}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Badge
                                    variant="outline"
                                    className={`h-5 min-w-[76px] justify-center px-2 text-[10px] font-black uppercase ${getStockBadgeClassName(
                                      product
                                    )}`}
                                  >
                                    stock {product.stock ?? 0}
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
                  <select
                    value={selectedCategory}
                    onChange={(event) => {
                      setSelectedCategory(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">Todas las categorias</option>
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
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
                  <div className="relative mb-4 h-28 w-28 overflow-hidden rounded-2xl ring-1 ring-border/70">
                    <Image
                      src="/logo.png"
                      alt="Logo Distri Low"
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  </div>
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
                          <span className="w-10 text-center text-sm">
                            {isWeighableProduct(item)
                              ? String(item.quantity)
                              : Math.trunc(item.quantity)}
                          </span>
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
                  <span>${roundTo(total, 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pagos iniciales:</span>
                  <span>${roundTo(totalInitialPayments, 2).toFixed(2)}</span>
                </div>
                {changeDuePreview > 0 && (
                  <div className="flex justify-between text-sm font-semibold text-emerald-700">
                    <span>Vuelto a entregar:</span>
                    <span>${roundTo(changeDuePreview, 2).toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>${roundTo(total, 2).toFixed(2)}</span>
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
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={cashPaymentAmount}
                        onChange={(event) =>
                          setCashPaymentAmount(event.target.value)
                        }
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-md font-bold text-muted-foreground">
                        Transferencia
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={transferPaymentAmount}
                        onChange={(event) =>
                          setTransferPaymentAmount(event.target.value)
                        }
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

      <AlertDialog
        open={isPaymentConfirmOpen}
        onOpenChange={setIsPaymentConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pago</AlertDialogTitle>
            <AlertDialogDescription>
              Total venta: <strong>${formatMoney(total)}</strong>. Pagos
              iniciales: <strong>${formatMoney(totalInitialPayments)}</strong>.
              Saldo pendiente:{" "}
              <strong>${formatMoney(pendingAfterInitialPayments)}</strong>.
              {changeDuePreview > 0 ? (
                <>
                  {" "}
                  Vuelto a entregar:{" "}
                  <strong>${formatMoney(changeDuePreview)}</strong>.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={processPayment}
              className="bg-primary hover:bg-primary/90"
              disabled={isProcessingPayment}
            >
              {isProcessingPayment && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar y Registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import useSWR from "swr";
import { swrFetcher } from "@/lib/swr-fetcher";
import type { PaymentMethod, PriceType, PricingMode } from "@/lib/api-types";
import { ProductCategoryIcon } from "@/components/products/components/ProductCategoryIcon";

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

type Category = {
  id: string;
  name: string;
};

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

  const getActivePrice = (product: Product) => getRetailPrice(product);

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
    const maxStock = Number(inCart?.stock ?? 0);
    const normalizedQuantity = roundTo(quantity, 3);

    if (inCart && normalizedQuantity > maxStock) {
      toast({
        title: "Stock insuficiente",
        description: `No puedes agregar mas de ${maxStock} unidades`,
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

  const updateManualOverrideReason = (id: string, reason: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, manualOverrideReason: reason } : item
      )
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

      const createdSale = await addSale({
        customerName: "Consumidor Final",
        lineItems: cart.map((item) => {
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

      const backendLineByProductId = new Map(
        (createdSale.lineItems ?? []).map((line) => [line.productId, line])
      );

      setCart((prev) =>
        prev.map((item) => {
          const backendLine = backendLineByProductId.get(item.id);
          if (!backendLine) return item;

          return {
            ...item,
            backendPriceType: backendLine.priceType,
            backendPricingSource: backendLine.pricingSource,
            backendUnitPrice: toSafeNumber(backendLine.price, NaN),
            backendSubtotal: toSafeNumber(backendLine.subtotal, NaN),
            backendBaseRetailPrice: toSafeNumber(
              backendLine.baseRetailPrice,
              NaN
            ),
            backendBaseWholesalePrice: toSafeNumber(
              backendLine.baseWholesalePrice,
              NaN
            ),
            backendPricingRuleSnapshot: backendLine.pricingRuleSnapshot,
            backendManualOverrideReason:
              backendLine.manualOverrideReason ?? null,
            visualPriceType: backendLine.priceType ?? item.visualPriceType,
          };
        })
      );
      setIsSaleCommitted(true);

      const paidAmount = Number(createdSale.paidAmount ?? 0);
      const outstandingAmount = Number(createdSale.outstandingAmount ?? 0);
      const backendTotal = Number(createdSale.totalAmount ?? total);

      toast({
        title: "Venta exitosa",
        description:
          outstandingAmount > 0
            ? `Venta por $${formatMoney(
                backendTotal
              )} registrada. Pagado: $${formatMoney(
                paidAmount
              )}. Saldo pendiente: $${formatMoney(outstandingAmount)}.`
            : `Venta por $${formatMoney(backendTotal)} registrada y pagada.`,
      });
      await mutateProducts();
      setIsPaymentConfirmOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al registrar venta",
        description: error?.message || "No se pudo registrar la venta.",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setIsSaleCommitted(false);
    setCashPaymentAmount("");
    setTransferPaymentAmount("");
    setTransferReference("");
    toast({
      title: "Carrito vaciado",
      description: "Se quitaron todos los productos del carrito.",
    });
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
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-8"
                    />
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
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-4 w-1/4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => {
                    const activePrice = getActivePrice(product);
                    return (
                      <Card
                        key={product.id}
                        className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                        onClick={() => {
                          if (isSaleCommitted) return;
                          addToCart(product);
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-3">
                            <ProductCategoryIcon
                              category={getProductCategoryLabel(product)}
                              className="h-12 w-12 shrink-0 rounded-md"
                              iconClassName="h-6 w-6"
                            />
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-bold transition-colors group-hover:text-primary">
                                {product.name}
                              </h3>
                              <p className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                                {getProductCategoryLabel(product)}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`h-5 min-w-[82px] justify-center p-2 text-[10px] font-black uppercase ${getStockBadgeClassName(
                                    product
                                  )}`}
                                >
                                  stock {product.stock ?? 0}
                                </Badge>
                              </div>
                              <p className="text-sm font-black text-primary">
                                ${formatMoney(activePrice)}{" "}
                                <span className="text-[10px] font-semibold text-muted-foreground">
                                  Minorista
                                </span>
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-muted-foreground">
                      No se encontraron productos.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Mostrando {showingFrom}-{showingTo} de {productsTotal}{" "}
                  productos.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={!hasMore}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Carrito</span>
                <Badge variant="secondary">{itemCount} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  Carrito vacio
                </p>
              ) : (
                <>
                  <div className="max-h-64 space-y-3 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-start space-x-2">
                        <ProductCategoryIcon
                          category={getProductCategoryLabel(item)}
                          className="h-10 w-10 shrink-0 rounded"
                          iconClassName="h-5 w-5"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-medium">
                            {item.name}
                          </h4>
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

                          <div className="mt-2 flex  gap-2">
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

                          <p className="mt-1 text-xs font-semibold">
                            Subtotal: $
                            {roundTo(getCartLineTotal(item), 2).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 pt-0.5">
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
                          <span className="w-8 text-center text-sm">
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
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>${roundTo(total, 2).toFixed(2)}</span>
                    </div>
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
                    <Button
                      className="w-full"
                      onClick={() => handlePayment()}
                      disabled={isProcessingPayment}
                    >
                      <Banknote className="mr-2 h-4 w-4" />
                      {isSaleCommitted ? "Nueva venta" : "Registrar Venta"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full" variant="ghost">
                          Limpiar Carrito
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Limpiar el carrito?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Se quitaran todos los productos seleccionados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={clearCart}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Limpiar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
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

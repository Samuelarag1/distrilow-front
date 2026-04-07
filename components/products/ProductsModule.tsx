import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductDialog } from "@/components/dialogs/product-dialog";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { useProductActions } from "@/components/providers/product-provider";
import { useBranch } from "@/components/providers/business-provider";
import { useUser } from "../providers/user-provider";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useProductSave } from "./hooks/useProductSave";
import { DeleteProductDialog } from "./components/DeleteProductDialog";
import { useApiSessionSync } from "./hooks/useApiSessionAsync";
import { swrFetcher } from "@/lib/swr-fetcher";
import { backendApi } from "@/lib/backend-api";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductPriceCostHistoryRow } from "@/lib/api-types";
import { Loader2, Printer } from "lucide-react";

type Category = {
  id: string;
  name: string;
  isActive?: boolean;
};

type SortKey = "name" | "cost" | "retail" | "wholesale" | "margin";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 20;
const PRINT_PAGE_SIZE = 200;
const RETAIL_MARGIN_GOOD_THRESHOLD = 30;
const WHOLESALE_MARGIN_GOOD_THRESHOLD = 20;

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function getMarginPercentForPrice(costPrice: unknown, sellPrice: unknown) {
  const cost = Number(costPrice ?? 0);
  const sell = Number(sellPrice ?? 0);
  if (cost <= 0) return 0;
  return ((sell - cost) / cost) * 100;
}

function getRetailMarginPercent(product: Product) {
  return getMarginPercentForPrice(product.costPrice, product.retailPrice);
}

function getWholesaleMarginPercent(product: Product) {
  return getMarginPercentForPrice(product.costPrice, product.wholesalePrice);
}

function hasSameRetailAndWholesalePrice(product: Product) {
  return Number(product.retailPrice ?? 0) === Number(product.wholesalePrice ?? 0);
}

function resolveStockMode(product: Product) {
  const productId = String(product.id ?? "").trim();
  const baseProductId = String(
    (product as any).stockBaseProductId ?? product.id ?? ""
  ).trim();
  if (
    product.trackStock !== false &&
    productId &&
    baseProductId &&
    baseProductId !== productId
  ) {
    return "shared" as const;
  }
  return "own" as const;
}

function resolveStockConsumptionLabel(product: Product) {
  if (product.trackStock === false) return null;
  const qtyRaw = Number((product as any).stockConsumptionQuantity ?? 1);
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
  const unit = String(
    (product as any).stockBaseUnit ?? product.measurementType ?? "unit"
  );
  return `Consume ${qty} ${unit}/venta`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printTableDocument(input: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  const popup = window.open("", "_blank", "width=1280,height=900");
  if (!popup) return false;

  const headersHtml = input.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const rowsHtml = input.rows
    .map((row) => {
      const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  popup.document.write(`
    <html>
      <head>
        <title>${escapeHtml(input.title)}</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { margin: 0; font-size: 22px; }
          p { margin: 4px 0 14px 0; color: #475569; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; }
          thead { background: #f1f5f9; }
          tr:nth-child(even) { background: #f8fafc; }
          .meta { margin-top: 12px; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(input.title)}</h1>
        <p>${escapeHtml(input.subtitle)}</p>
        <table>
          <thead><tr>${headersHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="meta">Generado: ${escapeHtml(new Date().toLocaleString())}</div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

export function ProductsModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addProduct, updateProduct, removeProduct } = useProductActions();
  const { activeBranchId } = useBranch();
  const { token, branchId } = useUser();
  const { toast } = useToast();

  useApiSessionSync(token, branchId);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [activeTab, setActiveTab] = useState("catalog");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [pendingPage, setPendingPage] = useState(1);
  const [pendingRows, setPendingRows] = useState<Product[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyRows, setHistoryRows] = useState<ProductPriceCostHistoryRow[]>(
    []
  );
  const [historyTotal, setHistoryTotal] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { products, total, take, hasMore, isLoading, isError, mutateProducts } =
    useProducts({
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      search: debouncedSearch,
      categoryId: selectedCategory === "all" ? null : selectedCategory,
      branchId: activeBranchId ?? null,
      sortBy: sortKey === "name" ? "name" : "price",
      sortOrder,
      resolveStockFromStocksEndpoint: false,
    });

  const { data: categoriesData } = useSWR<Category[]>(
    "/categories",
    swrFetcher
  );

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

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.value, category.label));
    return map;
  }, [categories]);

  const sortProductsForCurrentCriteria = useCallback(
    (rows: Product[]) => {
      const factor = sortOrder === "asc" ? 1 : -1;
      return [...rows].sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name) * factor;
        if (sortKey === "cost")
          return (Number(a.costPrice) - Number(b.costPrice)) * factor;
        if (sortKey === "retail")
          return (Number(a.retailPrice) - Number(b.retailPrice)) * factor;
        if (sortKey === "wholesale")
          return (Number(a.wholesalePrice) - Number(b.wholesalePrice)) * factor;
        return (getRetailMarginPercent(a) - getRetailMarginPercent(b)) * factor;
      });
    },
    [sortKey, sortOrder]
  );

  const sortedProducts = useMemo(() => {
    return sortProductsForCurrentCriteria(products);
  }, [products, sortProductsForCurrentCriteria]);

  const loadPending = useCallback(async () => {
    if (!activeBranchId) {
      setPendingRows([]);
      setPendingTotal(0);
      return;
    }
    try {
      setIsLoadingPending(true);
      const payload = await backendApi.products.reviewPending(
        {
          skip: (pendingPage - 1) * 20,
          take: 20,
        },
        activeBranchId
      );
      setPendingRows(payload.items as Product[]);
      setPendingTotal(payload.meta.total);
    } finally {
      setIsLoadingPending(false);
    }
  }, [activeBranchId, pendingPage]);

  const loadHistory = useCallback(async () => {
    if (!activeBranchId) {
      setHistoryRows([]);
      setHistoryTotal(0);
      return;
    }
    try {
      setIsLoadingHistory(true);
      const payload = await backendApi.products.priceHistory(
        {
          // skip: (historyPage - 1) * 20,
          // take: 20,
        },
        activeBranchId
      );
      setHistoryRows(payload.items);
      setHistoryTotal(payload.meta.total);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeBranchId, historyPage]);

  useEffect(() => {
    if (activeTab === "pending") void loadPending();
  }, [activeTab, loadPending]);

  useEffect(() => {
    if (activeTab === "history") void loadHistory();
  }, [activeTab, loadHistory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, activeBranchId]);

  useEffect(() => {
    const shouldOpenCreate = searchParams.get("create");
    if (shouldOpenCreate !== "1") return;
    if (!activeBranchId) return;
    setEditingProduct(null);
    setIsDialogOpen(true);
    router.replace("/products");
  }, [searchParams, activeBranchId, router]);

  const handleCreate = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    try {
      await removeProduct(productToDelete);
      await mutateProducts();
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos eliminar el producto",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente en unos segundos."
        ),
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleResolvePendingFlags = async (product: Product) => {
    try {
      await backendApi.products.updateReviewFlags(product.id, {
        priceReviewPending: false,
        costReviewPending: false,
      });
      toast({
        title: "Revision actualizada",
        description: "Se marcaron las revisiones como resueltas.",
      });
      await Promise.all([loadPending(), mutateProducts()]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente en unos segundos."
        ),
      });
    }
  };

  const handlePrintCurrentTable = useCallback(async () => {
    if (!activeBranchId) {
      toast({
        variant: "destructive",
        title: "Sucursal requerida",
        description: "Selecciona una sucursal para imprimir.",
      });
      return;
    }

    const fetchAllCatalogRows = async () => {
      const rows: Product[] = [];
      let skip = 0;

      while (true) {
        const payload = await backendApi.products.list(
          {
            skip,
            take: PRINT_PAGE_SIZE,
            search: debouncedSearch || undefined,
            categoryId: selectedCategory === "all" ? undefined : selectedCategory,
          },
          activeBranchId
        );
        rows.push(...(payload.items as Product[]));
        if (!payload.meta.hasMore || payload.items.length === 0) break;
        const nextOffset =
          Number(payload.meta.offset ?? skip) +
          Number(payload.meta.limit ?? PRINT_PAGE_SIZE);
        if (nextOffset <= skip) break;
        skip = nextOffset;
      }

      return sortProductsForCurrentCriteria(rows);
    };

    const fetchAllPendingRows = async () => {
      const rows: Product[] = [];
      let skip = 0;

      while (true) {
        const payload = await backendApi.products.reviewPending(
          {
            skip,
            take: PRINT_PAGE_SIZE,
          },
          activeBranchId
        );
        rows.push(...(payload.items as Product[]));
        if (!payload.meta.hasMore || payload.items.length === 0) break;
        const nextOffset =
          Number(payload.meta.offset ?? skip) +
          Number(payload.meta.limit ?? PRINT_PAGE_SIZE);
        if (nextOffset <= skip) break;
        skip = nextOffset;
      }

      return rows;
    };

    const fetchAllHistoryRows = async () => {
      const rows: ProductPriceCostHistoryRow[] = [];
      let skip = 0;

      while (true) {
        const payload = await backendApi.products.priceHistory(
          {
            skip,
            take: PRINT_PAGE_SIZE,
          },
          activeBranchId
        );
        rows.push(...payload.items);
        if (!payload.meta.hasMore || payload.items.length === 0) break;
        const nextOffset =
          Number(payload.meta.offset ?? skip) +
          Number(payload.meta.limit ?? PRINT_PAGE_SIZE);
        if (nextOffset <= skip) break;
        skip = nextOffset;
      }

      return rows;
    };

    try {
      setIsPrinting(true);

      if (activeTab === "catalog") {
        const rows = await fetchAllCatalogRows();
        const didOpen = printTableDocument({
          title: "Catalogo de productos",
          subtitle: `Sucursal ${activeBranchId} | Registros: ${rows.length}`,
          headers: [
            "PLU",
            "Nombre",
            "Categoria",
            "Costo",
            "Minorista",
            "Margen Minorista",
            "Mayorista",
            "Margen Mayorista",
            "Pendiente",
          ],
          rows: rows.map((product) => {
            const retailMargin = getRetailMarginPercent(product);
            const wholesaleMargin = getWholesaleMarginPercent(product);
            const sameRetailAndWholesalePrice =
              hasSameRetailAndWholesalePrice(product);
            return [
              product.pluCode ?? "-",
              product.name,
              product.categoryId
                ? categoryMap.get(product.categoryId) ?? product.categoryId
                : "-",
              formatMoney(Number(product.costPrice ?? 0)),
              formatMoney(Number(product.retailPrice ?? 0)),
              sameRetailAndWholesalePrice ? "-" : `${retailMargin.toFixed(2)}%`,
              formatMoney(Number(product.wholesalePrice ?? 0)),
              `${wholesaleMargin.toFixed(2)}%`,
              product.priceReviewPending || product.costReviewPending
                ? [
                    product.priceReviewPending ? "Precio" : "",
                    product.costReviewPending ? "Costo" : "",
                  ]
                    .filter(Boolean)
                    .join(" / ")
                : "-",
            ];
          }),
        });
        if (!didOpen) {
          toast({
            variant: "destructive",
            title: "Ventana bloqueada",
            description: "Habilita popups para imprimir.",
          });
        }
        return;
      }

      if (activeTab === "pending") {
        const rows = await fetchAllPendingRows();
        const didOpen = printTableDocument({
          title: "Productos pendientes de revision",
          subtitle: `Sucursal ${activeBranchId} | Registros: ${rows.length}`,
          headers: ["Producto", "SKU", "PLU", "Pendiente"],
          rows: rows.map((product) => [
            product.name,
            product.sku,
            product.pluCode ?? "-",
            [
              product.priceReviewPending ? "Precio" : "",
              product.costReviewPending ? "Costo" : "",
            ]
              .filter(Boolean)
              .join(" / ") || "-",
          ]),
        });
        if (!didOpen) {
          toast({
            variant: "destructive",
            title: "Ventana bloqueada",
            description: "Habilita popups para imprimir.",
          });
        }
        return;
      }

      const rows = await fetchAllHistoryRows();
      const didOpen = printTableDocument({
        title: "Historial de precio y costo",
        subtitle: `Sucursal ${activeBranchId} | Registros: ${rows.length}`,
        headers: [
          "Fecha",
          "Producto",
          "Costo (antes)",
          "Costo (despues)",
          "Minorista (antes)",
          "Minorista (despues)",
          "Mayorista (antes)",
          "Mayorista (despues)",
        ],
        rows: rows.map((row) => [
          row.createdAt ? new Date(row.createdAt).toLocaleString() : "-",
          row.name ?? row.product?.name ?? "Producto eliminado",
          formatMoney(Number(row.oldCostPrice ?? 0)),
          formatMoney(Number(row.newCostPrice ?? 0)),
          formatMoney(Number(row.oldRetailPrice ?? 0)),
          formatMoney(Number(row.newRetailPrice ?? 0)),
          formatMoney(Number(row.oldWholesalePrice ?? 0)),
          formatMoney(Number(row.newWholesalePrice ?? 0)),
        ]),
      });
      if (!didOpen) {
        toast({
          variant: "destructive",
          title: "Ventana bloqueada",
          description: "Habilita popups para imprimir.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No se pudo imprimir",
        description: getUserFacingErrorMessage(
          error,
          "Intenta nuevamente y revisa si el navegador bloqueo la ventana de impresion."
        ),
      });
    } finally {
      setIsPrinting(false);
    }
  }, [
    activeBranchId,
    activeTab,
    categoryMap,
    debouncedSearch,
    selectedCategory,
    sortProductsForCurrentCriteria,
    toast,
  ]);

  const { isSaving, handleSave } = useProductSave({
    editingProduct,
    activeBranchId,
    addProduct,
    updateProduct,
    mutate: mutateProducts,
    onCloseDialog: () => setIsDialogOpen(false),
    onClearEditing: () => setEditingProduct(null),
  });

  const resolvedPageSize = Math.max(1, Number(take ?? PAGE_SIZE) || PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / resolvedPageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const showingFrom =
    total === 0 ? 0 : (currentPageSafe - 1) * resolvedPageSize + 1;
  const showingTo =
    total === 0 ? 0 : Math.min(currentPageSafe * resolvedPageSize, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Productos
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void handlePrintCurrentTable()}
            disabled={!activeBranchId || isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Imprimir tabla
          </Button>
          <Button onClick={handleCreate} disabled={!activeBranchId || isPrinting}>
            Nuevo producto
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="catalog">Catalogo</TabsTrigger>
          <TabsTrigger value="pending">Pendientes de revision</TabsTrigger>
          <TabsTrigger value="history">Historial precio/costo</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="relative md:col-span-2">
                  <Input
                    placeholder="Buscar por nombre, sku o codigo..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="all">Todas las categorias</option>
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">
                  Ordenar:
                </Label>
                {(
                  [
                    ["name", "Nombre"],
                    ["cost", "Costo"],
                    ["margin", "Margen"],
                  ] as Array<[SortKey, string]>
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={sortKey === key ? "default" : "outline"}
                    onClick={() => {
                      if (sortKey === key) {
                        setSortOrder((prev) =>
                          prev === "asc" ? "desc" : "asc"
                        );
                      } else {
                        setSortKey(key);
                        setSortOrder("asc");
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {isError && (
                <p className="text-sm text-destructive">
                  Error al cargar productos:{" "}
                  {String((isError as any)?.message ?? isError)}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-md border">
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead className="bg-muted/40">
                    <tr>
                      {/* <th className="p-2 text-left text-xs font-semibold border-r">SKU</th> */}
                      <th className="p-2 text-left text-xs font-semibold border-r">
                        PLU
                      </th>
                      <th className="p-2 text-left text-xs font-semibold border-r">
                        Nombre
                      </th>
                      <th className="p-2 text-left text-xs font-semibold border-r">
                        Categoria
                      </th>
                      {/* <th className="p-2 text-center text-xs font-semibold border-r">Pesable</th> */}
                      <th className="p-2 text-right text-xs font-semibold border-r">
                        Costo
                      </th>
                      <th className="p-2 text-right text-xs font-semibold border-r">
                        Minorista
                      </th>
                      <th className="p-2 text-right text-xs font-semibold border-r">
                        Margen Minorista
                      </th>
                      <th className="p-2 text-right text-xs font-semibold border-r">
                        Mayorista
                      </th>
                      <th className="p-2 text-right text-xs font-semibold border-r">
                        Margen Mayorista
                      </th>
                      <th className="p-2 text-center text-xs font-semibold border-r">
                        Pendiente
                      </th>
                      <th className="p-2 text-center text-xs font-semibold">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="p-6 text-center text-sm text-muted-foreground"
                        >
                          Cargando productos...
                        </td>
                      </tr>
                    ) : sortedProducts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="p-6 text-center text-sm text-muted-foreground"
                        >
                          Sin productos para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      sortedProducts.map((product) => {
                        const retailMargin = getRetailMarginPercent(product);
                        const wholesaleMargin = getWholesaleMarginPercent(product);
                        const sameRetailAndWholesalePrice =
                          hasSameRetailAndWholesalePrice(product);
                        const lowRetailMargin =
                          !sameRetailAndWholesalePrice &&
                          retailMargin < RETAIL_MARGIN_GOOD_THRESHOLD;
                        const lowWholesaleMargin =
                          wholesaleMargin < WHOLESALE_MARGIN_GOOD_THRESHOLD;
                        return (
                          <tr
                            key={product.id}
                            className="border-t hover:bg-muted/20"
                          >
                            <td className="p-2 text-xs border-r">
                              {product.pluCode ?? "-"}
                            </td>
                            <td className="p-2 text-sm border-r font-medium">
                              <div className="flex flex-col gap-1">
                                <span>{product.name}</span>
                                {product.trackStock !== false && (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-semibold py-0 px-2"
                                    >
                                      {resolveStockMode(product) === "shared"
                                        ? "Stock compartido"
                                        : "Stock propio"}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      {resolveStockConsumptionLabel(product)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-xs border-r">
                              {product.categoryId
                                ? categoryMap.get(product.categoryId) ??
                                  product.categoryId
                                : "-"}
                            </td>
                            <td className="p-2 text-right text-xs border-r">
                              {formatMoney(Number(product.costPrice ?? 0))}
                            </td>
                            <td className="p-2 text-right text-xs border-r">
                              {formatMoney(Number(product.retailPrice ?? 0))}
                            </td>
                            <td
                              className={`p-2 text-right text-xs border-r font-semibold ${
                                sameRetailAndWholesalePrice
                                  ? "text-muted-foreground"
                                  : lowRetailMargin
                                    ? "text-red-600"
                                    : "text-emerald-600"
                              }`}
                            >
                              {sameRetailAndWholesalePrice
                                ? "-"
                                : `${retailMargin.toFixed(2)}%`}
                            </td>
                            <td className="p-2 text-right text-xs border-r">
                              {formatMoney(Number(product.wholesalePrice ?? 0))}
                            </td>
                            <td
                              className={`p-2 text-right text-xs border-r font-semibold ${
                                lowWholesaleMargin ? "text-red-600" : "text-emerald-600"
                              }`}
                            >
                              {wholesaleMargin.toFixed(2)}%
                            </td>
                            <td className="p-2 text-center text-xs border-r">
                              <div className="flex items-center justify-center gap-1">
                                {product.priceReviewPending && (
                                  <Badge variant="secondary">Precio</Badge>
                                )}
                                {product.costReviewPending && (
                                  <Badge variant="secondary">Costo</Badge>
                                )}
                                {!product.priceReviewPending &&
                                  !product.costReviewPending && (
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="p-2 text-center text-xs">
                              <div className="flex justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(product)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setProductToDelete(product.id);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {!!activeBranchId && !isLoading && total > 0 && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Mostrando {showingFrom}-{showingTo} de {total} productos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPageSafe <= 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Pagina {currentPageSafe} de {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={!hasMore || currentPageSafe >= totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <p className="text-sm text-muted-foreground">
                Productos con bandera de revision pendiente.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-left text-xs font-semibold">
                        Producto
                      </th>
                      <th className="p-2 text-left text-xs font-semibold">
                        SKU
                      </th>
                      <th className="p-2 text-left text-xs font-semibold">
                        PLU
                      </th>
                      <th className="p-2 text-left text-xs font-semibold">
                        Pendiente
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingPending ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-sm text-muted-foreground"
                        >
                          Cargando pendientes...
                        </td>
                      </tr>
                    ) : pendingRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-sm text-muted-foreground"
                        >
                          No hay productos pendientes.
                        </td>
                      </tr>
                    ) : (
                      pendingRows.map((product) => (
                        <tr key={product.id} className="border-t">
                          <td className="p-2 text-sm font-medium">
                            {product.name}
                          </td>
                          <td className="p-2 text-xs font-mono">
                            {product.sku}
                          </td>
                          <td className="p-2 text-xs">
                            {product.pluCode ?? "-"}
                          </td>
                          <td className="p-2 text-xs">
                            <div className="flex gap-1">
                              {product.priceReviewPending && (
                                <Badge variant="secondary">Precio</Badge>
                              )}
                              {product.costReviewPending && (
                                <Badge variant="secondary">Costo</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(product)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolvePendingFlags(product)}
                              >
                                Marcar revisado
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!isLoadingPending && pendingTotal > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {pendingTotal} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPendingPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={pendingPage <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingPage((prev) => prev + 1)}
                      disabled={pendingPage * 20 >= pendingTotal}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <p className="text-sm text-muted-foreground">
                Historial de cambios de precio y costo.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto">
                <table className="w-full min-w-[960px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 text-left text-xs font-semibold">
                        Fecha
                      </th>
                      <th className="p-2 text-left text-xs font-semibold">
                        Producto
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Costo (antes)
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Costo (despues)
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Minorista (antes)
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Minorista (despues)
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Mayorista (antes)
                      </th>
                      <th className="p-2 text-right text-xs font-semibold">
                        Mayorista (despues)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingHistory ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-6 text-center text-sm text-muted-foreground"
                        >
                          Cargando historial...
                        </td>
                      </tr>
                    ) : historyRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-6 text-center text-sm text-muted-foreground"
                        >
                          Sin historial de cambios.
                        </td>
                      </tr>
                    ) : (
                      historyRows.map((row) => (
                        <tr key={row.id} className="border-t">
                          <td className="p-2 text-xs">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleString()
                              : "-"}
                          </td>
                          <td className="p-2 text-xs">
                            {row.name ?? row.product?.name ?? "Producto eliminado"}
                          </td>
                          <td className="p-2 text-right text-xs">
                            {formatMoney(Number(row.oldCostPrice ?? 0))}
                          </td>
                          <td className="p-2 text-right text-xs">
                            {formatMoney(Number(row.newCostPrice ?? 0))}
                          </td>
                          <td className="p-2 text-right text-xs">
                            {formatMoney(Number(row.oldRetailPrice ?? 0))}
                          </td>
                          <td className="p-2 text-right text-xs">
                            {formatMoney(Number(row.newRetailPrice ?? 0))}
                          </td>
                          <td className="p-2 text-right text-xs">
                            {formatMoney(Number(row.oldWholesalePrice ?? 0))}
                          </td>
                          <td className="p-2 text-right text-xs">
                            {formatMoney(Number(row.newWholesalePrice ?? 0))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!isLoadingHistory && historyTotal > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {historyTotal} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setHistoryPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={historyPage <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryPage((prev) => prev + 1)}
                      disabled={historyPage * 20 >= historyTotal}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <DeleteProductDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// "use client";

import { useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductDialog } from "@/components/dialogs/product-dialog";
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
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";

import { useProductActions } from "@/components/providers/product-provider";
import { useBranch } from "@/components/providers/business-provider"; // <-- tu provider nuevo
import { Product } from "@/lib/products";
import { apiClientFetch, apiGet, setApiSession } from "@/lib/api-client"; // apiGet opcional
import { useUser } from "../providers/user-provider";

/**
 * ------------------------------------------------------------
 * Types / helpers
 * ------------------------------------------------------------
 */

type SortKey = "name" | "price" | "stock" | "category";
type SortOrder = "asc" | "desc";

// backend soporta estos (según lo que armamos)
type ApiSortBy =
  | "name"
  | "createdAt"
  | "costPrice"
  | "retailPrice"
  | "wholesalePrice";

type PageResponse = {
  items: Product[];
  total: number;
  skip: number;
  take: number;
  nextSkip: number | null;
  hasMore: boolean;
};

function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function buildQuery(params: Record<string, any>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "" || v === "all") return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

function mapSort(
  sortKey: SortKey,
  sortOrder: SortOrder
): { sortBy: ApiSortBy; sortOrder: SortOrder } {
  if (sortKey === "price") return { sortBy: "retailPrice", sortOrder };
  if (sortKey === "name") return { sortBy: "name", sortOrder };

  // stock/category no son columnas reales ordenables en tu entidad (por ahora)
  return { sortBy: "name", sortOrder };
}

function useInfiniteScroll(opts: {
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}) {
  const { enabled, onLoadMore, rootMargin = "900px" } = opts;
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root: null, rootMargin }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [enabled, onLoadMore, rootMargin, el]);

  return setEl;
}

/**
 * ------------------------------------------------------------
 * Hook SWR Infinite: paginado + cache por branch + filtros
 * ------------------------------------------------------------
 */
function useProductsInfinite(args: {
  take?: number;
  activeBranchId: string | null;
  search?: string;
  categoryId?: string | null;
  sortBy: ApiSortBy;
  sortOrder: SortOrder;
}) {
  const {
    take = 20,
    activeBranchId,
    search,
    categoryId,
    sortBy,
    sortOrder,
  } = args;

  const getKey = (pageIndex: number, previousPageData: PageResponse | null) => {
    if (!activeBranchId) return null;
    if (previousPageData && !previousPageData.hasMore) return null;

    const skip = pageIndex * take;

    // clave de cache: branch + filtros + pagina
    return [
      "/products",
      activeBranchId,
      skip,
      take,
      search ?? "",
      categoryId ?? "",
      sortBy,
      sortOrder,
    ] as const;
  };

  const fetchPage = async (key: readonly any[]) => {
    const [, , skip, take, search, categoryId, sortBy, sortOrder] = key;

    const qs = buildQuery({
      skip,
      take,
      search,
      categoryId,
      sortBy,
      sortOrder,
    });

    // ✅ ACÁ estaba tu error: apiClientFetch NO es callable.
    // Usamos .get (o apiGet<PageResponse>)
    return apiGet<PageResponse>(`/products${qs}`);
    // si no querés apiGet:
    // return apiClientFetch.get(`/products${qs}`) as Promise<PageResponse>;
  };

  const swr = useSWRInfinite<PageResponse>(getKey, fetchPage, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    persistSize: true,
    keepPreviousData: true,
  });

  const pages = swr.data ?? [];
  const products = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;
  const hasMore = pages.length ? pages[pages.length - 1].hasMore : false;

  const isLoadingInitial = !swr.data && swr.isLoading;
  const isLoadingMore = !!swr.data && swr.isLoading;

  const loadMore = () => swr.setSize((s) => s + 1);

  return {
    ...swr,
    products,
    total,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
  };
}

/**
 * ------------------------------------------------------------
 * ProductsModule
 * ------------------------------------------------------------
 */

export function ProductsModule() {
  const { addProduct, updateProduct, removeProduct } = useProductActions();
  const { activeBranchId, availableBranches, setActiveBranch } = useBranch();

  const { token, branchId, branches, setBranchId } = useUser();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  const [selectedCategory, setSelectedCategory] = useState("all");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const { sortBy, sortOrder: mappedSortOrder } = useMemo(
    () => mapSort(sortKey, sortOrder),
    [sortKey, sortOrder]
  );

  const {
    products,
    total,
    hasMore,
    isLoadingInitial,
    isLoadingMore,
    loadMore,
    mutate,
    error,
  } = useProductsInfinite({
    activeBranchId,
    take: 20,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    sortBy,
    sortOrder: mappedSortOrder,
  });

  // categorías derivadas de lo que ya cargaste (si querés completo, conviene endpoint /categories)
  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((p) => p.categoryId).filter(Boolean))
    ) as string[];
  }, [products]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteTrigger = (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      await removeProduct(productToDelete);
      await mutate(); // refresca cache (páginas actuales)
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: e?.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleSave = async (productData: Partial<Product>) => {
    setIsSaving(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        toast({
          title: "Producto actualizado",
          description: "Los cambios han sido guardados correctamente.",
        });
      } else {
        await addProduct(productData);
        toast({
          title: "Producto creado",
          description: "El nuevo producto ha sido agregado correctamente.",
        });
      }

      await mutate(); // revalida listado
      setIsDialogOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: err?.message || "Ocurrió un error inesperado.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sentinelRef = useInfiniteScroll({
    enabled: !!activeBranchId && hasMore && !isLoadingMore,
    onLoadMore: loadMore,
  });

  function SortButton({
    label,
    sortKey: key,
  }: {
    label: string;
    sortKey: SortKey;
  }) {
    const isActive = sortKey === key;
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        className="h-8 text-xs font-medium"
        onClick={() => handleSort(key)}
        disabled={!activeBranchId}
      >
        {label}
        {isActive ? (
          sortOrder === "asc" ? (
            <ArrowUp className="ml-1 h-3 w-3" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        )}
      </Button>
    );
  }

  const isLoading = isLoadingInitial;
  const isEmpty = !isLoading && products.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Productos
          </h1>
          <p className="text-muted-foreground">
            Gestiona tu catálogo de productos
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingProduct(null);
            setIsDialogOpen(true);
          }}
          className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
          // disabled={!activeBranchId}
          title={
            !activeBranchId
              ? "Seleccioná una sucursal para gestionar productos"
              : undefined
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos por nombre o descripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  disabled={!activeBranchId}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={!activeBranchId}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {/* <select
                value={activeBranchId ?? "all"}
                onChange={(e) => setActiveBranch(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all" disabled>
                  Seleccionar sucursal…
                </option>
                {availableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select> */}
              <select
                value={branchId ?? ""} // ✅ usa la misma branch real
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  setBranchId(id); // ✅ actualiza estado global real
                  if (token) setApiSession(token, id); // ✅ actualiza X-Branch-Id
                  document.cookie = `activeBranchId=${id}; path=/`; // ✅ persiste
                }}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Seleccionar sucursal…</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-sm text-muted-foreground font-medium mr-2">
                Ordenar por:
              </span>
              <SortButton label="Nombre" sortKey="name" />
              <SortButton label="Precio" sortKey="price" />
              <SortButton label="Stock" sortKey="stock" />
              <SortButton label="Categoría" sortKey="category" />

              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                {!!activeBranchId && (
                  <>
                    <span>
                      {products.length.toLocaleString()} /{" "}
                      {total.toLocaleString()}
                    </span>
                    {isLoadingMore && (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        cargando…
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {!activeBranchId && (
              <div className="text-sm text-muted-foreground">
                Seleccioná una sucursal para cargar el catálogo.
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive">
                Error al cargar productos:{" "}
                {String((error as any)?.message ?? error)}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-video w-full rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <div className="flex justify-between">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                </div>
              ))
            ) : isEmpty ? (
              <div className="col-span-full py-12 text-center">
                <p className="text-muted-foreground">
                  No se encontraron productos.
                </p>
              </div>
            ) : (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={handleEdit}
                  onDelete={handleDeleteTrigger}
                />
              ))
            )}
          </div>

          {!!activeBranchId && (
            <>
              <div ref={sentinelRef} className="h-10" />
              {isLoadingMore && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Cargando más productos...
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Ya cargaste todo el catálogo.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        onSave={handleSave}
        // si tu dialog no acepta esta prop, borrala
        // isSaving={isSaving as any}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Está seguro de eliminar este producto?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto se eliminará
              permanentemente de su catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-primary">
      <div className="aspect-video bg-muted relative overflow-hidden">
        <Image
          src={"/placeholder.svg"}
          alt={product.name}
          width={400}
          height={225}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <Badge
            variant="secondary"
            className="backdrop-blur-md bg-white/70 dark:bg-black/70 border-none shadow-sm text-xs"
          >
            {product.categoryId}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between min-h-[3rem]">
            <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(product)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar Detalles
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(product.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Producto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {product.description}
          </p>

          <div className="flex items-end justify-between pt-2">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Precios
              </span>

              <div className="flex items-center justify-between w-full border-b border-dashed pb-1">
                <span className="text-xs font-bold text-muted-foreground">
                  Minorista
                </span>
                <span className="font-black text-sm text-foreground">
                  ${Number((product as any).retailPrice ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-muted-foreground">
                  Mayorista
                </span>
                <span className="font-black text-sm text-foreground">
                  ${Number(product.wholesalePrice ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                Envasado
              </span>
              <Badge
                variant="secondary"
                className="font-black text-[10px] py-0 px-2 mt-1"
              >
                {(product as any).measurementType || "U."}
              </Badge>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">
                Existencia
              </span>
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full border border-dashed">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                  unidades
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

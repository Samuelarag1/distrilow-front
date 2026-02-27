// components/products/ProductsModule.tsx
// "use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProductDialog } from "@/components/dialogs/product-dialog";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/lib/products";

import { useProductActions } from "@/components/providers/product-provider";
import { useBranch } from "@/components/providers/business-provider";
import { useUser } from "../providers/user-provider";

import { mapSort } from "./utils/sort";

import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useProductsInfinite } from "./hooks/useProductsInfinite";
import { useInfiniteScroll } from "./hooks/useInfiniteScroll";
import { useProductSave } from "./hooks/useProductSave";

import { ProductsHeader } from "./components/ProductsHeader";
import { ProductsGrid } from "./components/ProductsGrid";
import { DeleteProductDialog } from "./components/DeleteProductDialog";
import { useApiSessionSync } from "./hooks/useApiSessionAsync";
import { ProductsToolbar } from "./components/ProductsToolBar";
import { ProductsSortBar } from "./components/ProductSortBar";
import { SortKey, SortOrder } from "./types/product";

export function ProductsModule() {
  const { addProduct, updateProduct, removeProduct } = useProductActions();
  const { activeBranchId } = useBranch();

  const { token, branchId, branches, setBranchId } = useUser();
  const { toast } = useToast();

  // mantiene tu sesión API sincronizada
  useApiSessionSync(token, branchId);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  const [selectedCategory, setSelectedCategory] = useState("all");

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
    take: 30,
    maxItems: 30,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    sortBy,
    sortOrder: mappedSortOrder,
  });

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

  const handleCreate = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
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
      await mutate();
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

  const { isSaving, handleSave } = useProductSave({
    editingProduct,
    addProduct,
    updateProduct,
    mutate,
    onCloseDialog: () => setIsDialogOpen(false),
    onClearEditing: () => setEditingProduct(null),
  });

  const sentinelRef = useInfiniteScroll({
    enabled: !!activeBranchId && hasMore && !isLoadingMore,
    onLoadMore: loadMore,
  });

  const isLoading = isLoadingInitial;
  const isEmpty = !isLoading && products.length === 0;
  return (
    <div className="space-y-6">
      <ProductsHeader activeBranchId={activeBranchId} onCreate={handleCreate} />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col space-y-4">
            <ProductsToolbar
              activeBranchId={activeBranchId}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              categories={categories}
              onCategoryChange={setSelectedCategory}
              branchId={branchId}
              branches={branches}
              token={token}
              onBranchChange={(id) => setBranchId(id)}
            />

            <ProductsSortBar
              activeBranchId={activeBranchId}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={handleSort}
              productsCount={products.length}
              total={total}
              isLoadingMore={isLoadingMore}
            />

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
          <ProductsGrid
            isLoading={isLoading}
            isEmpty={isEmpty}
            products={products}
            onEdit={handleEdit}
            onDelete={handleDeleteTrigger}
          />

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
                  Mostrando hasta 30 productos. Usa la busqueda para traer mas.
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

      <DeleteProductDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}


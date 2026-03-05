import { useEffect, useMemo, useState } from "react";
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

import { mapSort } from "./utils/sort";

import { useDebouncedValue } from "./hooks/useDebouncedValue";
import { useProductSave } from "./hooks/useProductSave";

import { ProductsHeader } from "./components/ProductsHeader";
import { ProductsGrid } from "./components/ProductsGrid";
import { DeleteProductDialog } from "./components/DeleteProductDialog";
import { useApiSessionSync } from "./hooks/useApiSessionAsync";
import { ProductsToolbar } from "./components/ProductsToolBar";
import { ProductsSortBar } from "./components/ProductSortBar";
import { SortKey, SortOrder } from "./types/product";
import { swrFetcher } from "@/lib/swr-fetcher";

type Category = {
  id: string;
  name: string;
  isActive?: boolean;
};

const PAGE_SIZE = 20;

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
    isLoading,
    isError,
    mutateProducts,
  } = useProducts({
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    branchId: activeBranchId ?? null,
    sortBy,
    sortOrder: mappedSortOrder,
  });

  const { data: categoriesData } = useSWR<Category[]>("/categories", swrFetcher);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const showingFrom = total === 0 ? 0 : (currentPageSafe - 1) * PAGE_SIZE + 1;
  const showingTo = total === 0 ? 0 : Math.min(currentPageSafe * PAGE_SIZE, total);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, sortBy, mappedSortOrder, activeBranchId]);

  const handleSort = (key: SortKey) => {
    setCurrentPage(1);
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
      await mutateProducts();
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente.",
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: e?.message || "Ocurrio un error inesperado.",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const { isSaving, handleSave } = useProductSave({
    editingProduct,
    activeBranchId,
    addProduct,
    updateProduct,
    mutate: mutateProducts,
    onCloseDialog: () => setIsDialogOpen(false),
    onClearEditing: () => setEditingProduct(null),
  });

  useEffect(() => {
    const shouldOpenCreate = searchParams.get("create");
    if (shouldOpenCreate !== "1") return;
    if (!activeBranchId) return;

    setEditingProduct(null);
    setIsDialogOpen(true);
    router.replace("/products");
  }, [searchParams, activeBranchId, router]);

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
              onSearchChange={(value) => {
                setSearchQuery(value);
                setCurrentPage(1);
              }}
              selectedCategory={selectedCategory}
              categories={categories}
              onCategoryChange={(value) => {
                setSelectedCategory(value);
                setCurrentPage(1);
              }}
            />

            <ProductsSortBar
              activeBranchId={activeBranchId}
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSort={handleSort}
              productsCount={products.length}
              total={total}
              isLoadingMore={isLoading}
            />

            {!activeBranchId && (
              <div className="text-sm text-muted-foreground">
                Selecciona una sucursal para cargar el catalogo.
              </div>
            )}

            {isError && (
              <div className="text-sm text-destructive">
                Error al cargar productos:{" "}
                {String((isError as any)?.message ?? isError)}
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

          {!!activeBranchId && !isLoading && total > 0 && (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {showingFrom}-{showingTo} de {total} productos
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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

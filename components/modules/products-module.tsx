"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreHorizontal, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductDialog } from "@/components/dialogs/product-dialog";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { useProducts, Product } from "@/components/providers/product-provider";
import { useBranches } from "@/components/providers/branch-provider";
import { useBusiness } from "@/components/providers/business-provider";

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

type SortKey = "name" | "price" | "stock" | "category";
type SortOrder = "asc" | "desc";

export function ProductsModule() {
  const { products, addProduct, updateProduct, removeProduct, updateStock } = useProducts();
  const { branches } = useBranches();
  const { businessType } = useBusiness();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const { toast } = useToast();

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      const matchesBranch =
        selectedBranch === "all" || product.branchId === selectedBranch;
      return matchesSearch && matchesCategory && matchesBranch;
    })
    .sort((a, b) => {
      const factor = sortOrder === "asc" ? 1 : -1;
      const valA = a[sortKey] || 0;
      const valB = b[sortKey] || 0;
      if (valA < valB) return -1 * factor;
      if (valA > valB) return 1 * factor;
      return 0;
    });

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDeleteTrigger = (productId: string) => {
    setProductToDelete(productId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (productToDelete) {
      removeProduct(productToDelete);
      toast({
        title: "Producto eliminado",
        description: "El producto ha sido eliminado correctamente.",
      });
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const handleSave = (productData: Partial<Product>) => {
    if (editingProduct) {
      updateProduct(editingProduct.id, productData);
      toast({
        title: "Producto actualizado",
        description: "Los cambios han sido guardados correctamente.",
      });
    } else {
      addProduct(productData as Omit<Product, "id">);
      toast({
        title: "Producto creado",
        description: "El nuevo producto ha sido agregado correctamente.",
      });
    }
    setIsDialogOpen(false);
    setEditingProduct(null);
  };

  function SortButton({ label, sortKey: key }: { label: string, sortKey: SortKey }) {
    const isActive = sortKey === key;
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        className="h-8 text-xs font-medium"
        onClick={() => handleSort(key)}
      >
        {label}
        {isActive ? (
          sortOrder === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
        ) : (
          <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
        )}
      </Button>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Productos
          </h1>
          <p className="text-muted-foreground">
            Gestiona tu catálogo de productos y existencias
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingProduct(null);
            setIsDialogOpen(true);
          }}
          className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
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
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-sm text-muted-foreground font-medium mr-2">Ordenar por:</span>
              <SortButton label="Nombre" sortKey="name" />
              <SortButton label="Precio" sortKey="price" />
              <SortButton label="Stock" sortKey="stock" />
              <SortButton label="Categoría" sortKey="category" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={handleEdit}
                onDelete={handleDeleteTrigger}
                onStockUpdate={updateStock}
                businessType={businessType}
                branches={branches}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <ProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        onSave={handleSave}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar este producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto se eliminará permanentemente de su catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
  onStockUpdate,
  businessType,
  branches
}: {
  product: Product,
  onEdit: (p: Product) => void,
  onDelete: (id: string) => void,
  onStockUpdate: (id: string, val: number) => void,
  businessType: string,
  branches: any[]
}) {
  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-primary">
      <div className="aspect-video bg-muted relative overflow-hidden">
        <Image
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          width={400}
          height={225}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 right-2 flex flex-col gap-2">
          <Badge
            className={`${product.status === "active"
              ? "bg-green-500 hover:bg-green-600 border-none"
              : "bg-gray-500 hover:bg-gray-600 border-none"
              } shadow-sm`}
          >
            {product.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
          <Badge variant="secondary" className="backdrop-blur-md bg-white/70 dark:bg-black/70 border-none shadow-sm text-xs">
            {product.category}
          </Badge>
          <Badge variant="outline" className="backdrop-blur-md bg-white/50 dark:bg-black/50 border-none shadow-sm text-[10px] font-bold">
            {branches.find(b => b.id === product.branchId)?.name || 'Sin Sucursal'}
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
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Precios Unitarios</span>
              <div className="flex items-center justify-between w-full border-b border-dashed pb-1">
                <span className="text-xs font-bold text-muted-foreground">Minorista</span>
                <span className={`font-black text-sm ${businessType === 'retail' ? 'text-primary' : 'text-foreground'}`}>
                  ${product.price.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-muted-foreground">Mayorista</span>
                <span className={`font-black text-sm ${businessType === 'wholesale' ? 'text-primary' : 'text-foreground'}`}>
                  ${product.wholesalePrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Envasado</span>
              <Badge variant="secondary" className="font-black text-[10px] py-0 px-2 mt-1">
                {product.unit || 'U.'}
              </Badge>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Existencia</span>
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1 rounded-full border border-dashed">
                <span className={`font-black text-sm ${product.stock <= (product.minStock || 0) ? 'text-red-500' : 'text-foreground'}`}>
                  {product.stock}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">unidades</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

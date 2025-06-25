"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductDialog } from "@/components/dialogs/product-dialog";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  status: "active" | "inactive";
  image: string;
}

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Cerveza Rubia",
    description: "Cerveza refrescante, ideal para compartir bien fría.",
    price: 4000,
    category: "Cervezas",
    stock: 30,
    status: "active",
    image: "/products/cerveza.jpg",
  },
  {
    id: "2",
    name: "Vino Tinto",
    description: "Vino tinto suave, perfecto para carnes o pastas.",
    price: 15000,
    category: "Vinos",
    stock: 20,
    status: "active",
    image: "/products/vino.jpg",
  },
  {
    id: "3",
    name: "Fernet Branca",
    description: "El clásico fernet argentino, ideal con cola.",
    price: 12000,
    category: "Tragos",
    stock: 10,
    status: "active",
    image: "/products/fernet.webp",
  },
  {
    id: "4",
    name: "Vodka",
    description: "Vodka neutro, ideal para tragos o solo con hielo.",
    price: 12000,
    category: "Destilados",
    stock: 12,
    status: "inactive",
    image: "/products/vodka.webp",
  },
  {
    id: "5",
    name: "Gin Tonic",
    description: "Trago fresco de gin con tónica y rodaja de limón.",
    price: 9000,
    category: "Tragos",
    stock: 18,
    status: "active",
    image: "/products/gin.png",
  },
  {
    id: "6",
    name: "Whisky",
    description: "Whisky añejado, ideal para tomar solo o con hielo.",
    price: 15000,
    category: "Destilados",
    stock: 9,
    status: "active",
    image: "/products/blue.jpg",
  },
];

export function ProductsModule() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDelete = (productId: string) => {
    setProducts(products.filter((p) => p.id !== productId));
    toast({
      title: "Producto eliminado",
      description: "El producto ha sido eliminado correctamente.",
    });
  };

  const handleSave = (productData: Partial<Product>) => {
    if (editingProduct) {
      setProducts(
        products.map((p) =>
          p.id === editingProduct.id ? { ...p, ...productData } : p
        )
      );
      toast({
        title: "Producto actualizado",
        description: "Los cambios han sido guardados correctamente.",
      });
    } else {
      const newProduct: Product = {
        ...(productData as Product),
        id: Date.now().toString(),
      };
      setProducts([...products, newProduct]);
      toast({
        title: "Producto creado",
        description: "El nuevo producto ha sido agregado correctamente.",
      });
    }
    setIsDialogOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
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
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-muted relative">
                  <Image
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    width={100}
                    height={100}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                  <Badge
                    className={`absolute top-2 right-2 ${
                      product.status === "active"
                        ? "bg-green-500"
                        : "bg-gray-500"
                    }`}
                  >
                    {product.status === "active" ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-sm leading-tight">
                        {product.name}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(product.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">
                        ${product.price.toFixed(2)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Stock: {product.stock}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {product.category}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No se encontraron productos
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        product={editingProduct}
        onSave={handleSave}
      />
    </div>
  );
}

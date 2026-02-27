"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Search,
  ScanLine,
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
import { useBusiness } from "@/components/providers/business-provider";
import { useBranches } from "@/components/providers/branch-provider";
import { Product, productsApi } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";

interface CartItem extends Product {
  quantity: number;
}

export function POSModule() {
  const { addSale } = useTransactions();
  const { currentUser } = useUser();
  const { businessType } = useBusiness();
  const { branches } = useBranches();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(
    null
  );
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const { products, isLoading } = useProducts({
    take: 30,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    branchId: selectedBranch === "all" ? null : selectedBranch,
  });

  useEffect(() => {
    if (selectedBranch === "all" && branches.length > 0) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.categoryId === selectedCategory;
      const matchesBranch =
        selectedBranch === "all" || product.branchId === selectedBranch;
      return matchesSearch && matchesCategory && matchesBranch;
    });
  }, [products, searchQuery, selectedCategory, selectedBranch]);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.categoryId).filter(Boolean))),
    [products]
  ) as string[];

  const addToCart = (product: Product) => {
    const stock = Number(product.stock ?? 0);
    if (stock <= 0) {
      toast({
        title: "Sin stock",
        description: `No hay unidades disponibles de ${product.name}`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          toast({
            title: "Stock limitado",
            description: `Solo hay ${stock} unidades de ${product.name}`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    const inCart = cart.find((p) => p.id === id);
    const maxStock = Number(inCart?.stock ?? 0);
    if (inCart && quantity > maxStock) {
      toast({
        title: "Stock insuficiente",
        description: `No puedes agregar mas de ${maxStock} unidades`,
        variant: "destructive",
      });
      return;
    }

    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleScanProduct = async () => {
    const code = scanQuery.trim();
    if (!code) return;

    try {
      let scanned =
        products.find((p) => p.barcode === code || p.sku === code) || null;

      if (!scanned) {
        scanned = await productsApi.getByBarcode(code);
      }

      if (!scanned) {
        toast({
          variant: "destructive",
          title: "Producto no encontrado",
          description: `No existe un producto para el codigo ${code}.`,
        });
        return;
      }

      if (
        selectedBranch !== "all" &&
        scanned.branchId &&
        scanned.branchId !== selectedBranch
      ) {
        toast({
          variant: "destructive",
          title: "Sucursal diferente",
          description: "El producto escaneado no corresponde a la sucursal activa.",
        });
        return;
      }

      const activePrice =
        businessType === "wholesale"
          ? scanned.wholesalePrice
          : scanned.retailPrice || scanned.costPrice;

      addToCart({ ...scanned, costPrice: activePrice });
      setSearchQuery(scanned.name);
      setScanQuery("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al escanear",
        description: error?.message || "No se pudo procesar el codigo escaneado.",
      });
    }
  };

  const total = cart.reduce((sum, item) => {
    const price = item.costPrice || 0;
    return sum + price * item.quantity;
  }, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePayment = (method: string) => {
    if (cart.length === 0) {
      toast({
        title: "Carrito vacio",
        description: "Agrega productos al carrito antes de procesar el pago",
        variant: "destructive",
      });
      return;
    }
    setPendingPaymentMethod(method);
    setIsPaymentConfirmOpen(true);
  };

  const processPayment = () => {
    const method = pendingPaymentMethod || "Efectivo";

    addSale({
      amount: total,
      customerName: "Consumidor Final",
      items: itemCount,
      lineItems: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.costPrice,
      })),
      userId: currentUser?.id || "unknown",
      userName: currentUser?.name || "Anonimo",
      branchId: selectedBranch === "all" ? branches[0]?.id || "unknown" : selectedBranch,
      businessType,
    });

    toast({
      title: "Venta exitosa",
      description: `Venta por $${total.toLocaleString()} registrada con ${method}`,
    });
    setCart([]);
    setIsPaymentConfirmOpen(false);
    setPendingPaymentMethod(null);
  };

  const clearCart = () => {
    setCart([]);
    toast({
      title: "Carrito vaciado",
      description: "Se quitaron todos los productos del carrito.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Punto de Venta
          </h1>
          <p className="text-muted-foreground">Flujo rapido para caja y mostrador</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Escanear o escribir codigo de barras"
                      value={scanQuery}
                      onChange={(e) => setScanQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleScanProduct();
                        }
                      }}
                      className="pl-8"
                    />
                  </div>
                  <Button onClick={handleScanProduct}>Agregar</Button>
                </div>

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
                    <option value="all">Todas las categorias</option>
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <Skeleton className="w-12 h-12 rounded-md shrink-0" />
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
                    const activePrice =
                      businessType === "wholesale"
                        ? product.wholesalePrice
                        : product.retailPrice || product.costPrice;
                    return (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden"
                        onClick={() =>
                          addToCart({ ...product, costPrice: activePrice })
                        }
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              <img
                                src={product.brand || "/placeholder.svg"}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                                {product.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4 uppercase font-black"
                                >
                                  stock {product.stock ?? 0}
                                </Badge>
                                <p className="text-[10px] text-muted-foreground truncate uppercase font-bold">
                                  {product.categoryId}
                                </p>
                              </div>
                              <p className="font-black text-sm text-primary">
                                ${activePrice.toLocaleString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-primary/10"
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
              <div className="pt-4 text-xs text-muted-foreground">
                Mostrando hasta 30 productos por busqueda para mantener la velocidad.
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
                <p className="text-center text-muted-foreground py-8">Carrito vacio</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <img
                          src={item.brand || "/placeholder.svg"}
                          alt={item.name}
                          className="w-10 h-10 rounded object-cover bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            ${Number(item.costPrice).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeFromCart(item.id)}
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
                      <span>${Number(total).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>${Number(total).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button className="w-full" onClick={() => handlePayment("Efectivo")}>
                      <Banknote className="mr-2 h-4 w-4" />
                      Pagar en Efectivo
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handlePayment("Tarjeta")}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pagar con Tarjeta
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full" variant="ghost">
                          Limpiar Carrito
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Limpiar el carrito?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se quitaran todos los productos seleccionados. Esta accion no
                            se puede deshacer.
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

      <AlertDialog open={isPaymentConfirmOpen} onOpenChange={setIsPaymentConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pago</AlertDialogTitle>
            <AlertDialogDescription>
              Deseas procesar el pago de <strong>${Number(total).toLocaleString()}</strong>{" "}
              usando{" "}
              <strong>
                {pendingPaymentMethod === "Efectivo" ? "Efectivo" : "Tarjeta"}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPaymentMethod(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={processPayment}
              className="bg-primary hover:bg-primary/90"
            >
              Confirmar y Registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
  CreditCard,
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
import { useBusiness } from "@/components/providers/business-provider";
import { Product, productsApi } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { backendApi } from "@/lib/backend-api";

interface CartItem extends Product {
  quantity: number;
}

export function POSModule() {
  const { addSale } = useTransactions();
  const { currentUser, branchId, branches } = useUser();
  const { businessType } = useBusiness();
  const { toast } = useToast();

  const canManageCash =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "cashier";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(
    null
  );
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const previousBranchRef = useRef<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const { products, isLoading, mutateProducts } = useProducts({
    take: 30,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    branchId: branchId ?? null,
  });

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
      toast({
        title: "Sucursal cambiada",
        description:
          "Se limpio el carrito para evitar mezclar productos entre sucursales.",
      });
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

  const categories = useMemo(
    () =>
      Array.from(new Set(products.map((product) => product.categoryId).filter(Boolean))),
    [products]
  ) as string[];

  const addToCart = (product: Product) => {
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
    const inCart = cart.find((product) => product.id === id);
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
      return;
    }

    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleScanProduct = async () => {
    const code = scanQuery.trim();
    if (!code) return;

    try {
      let scanned =
        products.find((product) => product.barcode === code || product.sku === code) ||
        null;

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
        description:
          error?.message || "No se pudo procesar el codigo escaneado.",
      });
    }
  };

  const total = cart.reduce((sum, item) => {
    const price = item.costPrice || 0;
    return sum + price * item.quantity;
  }, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  const handlePayment = async (method: string) => {
    if (cart.length === 0) {
      toast({
        title: "Carrito vacio",
        description: "Agrega productos al carrito antes de procesar el pago",
        variant: "destructive",
      });
      return;
    }

    const canProceed = await ensureOpenCashSession();
    if (!canProceed) return;

    setPendingPaymentMethod(method);
    setIsPaymentConfirmOpen(true);
  };

  const processPayment = async () => {
    const method = pendingPaymentMethod || "Efectivo";
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

      setIsProcessingPayment(true);
      await addSale({
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
        branchId: saleBranchId,
        businessType,
      });

      toast({
        title: "Venta exitosa",
        description: `Venta por $${total.toLocaleString()} registrada con ${method}`,
      });
      await mutateProducts();
      setCart([]);
      setIsPaymentConfirmOpen(false);
      setPendingPaymentMethod(null);
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
          <p className="text-muted-foreground">Flujo rapido para caja y mostrador</p>
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
                    />
                  </div>
                  <Button onClick={handleScanProduct}>Agregar</Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">Todas las categorias</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
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
                    const activePrice =
                      businessType === "wholesale"
                        ? product.wholesalePrice
                        : product.retailPrice || product.costPrice;
                    return (
                      <Card
                        key={product.id}
                        className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
                        onClick={() => addToCart({ ...product, costPrice: activePrice })}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                              <img
                                src={product.brand || "/placeholder.svg"}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-bold transition-colors group-hover:text-primary">
                                {product.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1 py-0 text-[10px] font-black uppercase"
                                >
                                  stock {product.stock ?? 0}
                                </Badge>
                                <p className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                                  {product.categoryId}
                                </p>
                              </div>
                              <p className="text-sm font-black text-primary">
                                ${activePrice.toLocaleString()}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-muted-foreground">No se encontraron productos.</p>
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
                <p className="py-8 text-center text-muted-foreground">Carrito vacio</p>
              ) : (
                <>
                  <div className="max-h-64 space-y-3 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <img
                          src={item.brand || "/placeholder.svg"}
                          alt={item.name}
                          className="h-10 w-10 rounded bg-muted object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-medium">{item.name}</h4>
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
                    <Button
                      className="w-full"
                      onClick={() => handlePayment("Efectivo")}
                      disabled={isProcessingPayment}
                    >
                      <Banknote className="mr-2 h-4 w-4" />
                      Pagar en Efectivo
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handlePayment("Tarjeta")}
                      disabled={isProcessingPayment}
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
              disabled={isProcessingPayment}
            >
              {isProcessingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar y Registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

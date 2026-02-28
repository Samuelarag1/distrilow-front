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
  Wallet,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTransactions } from "@/components/providers/transactions-provider";
import { useUser } from "@/components/providers/user-provider";
import { useBusiness } from "@/components/providers/business-provider";
import { useBranches } from "@/components/providers/branch-provider";
import { Product, productsApi } from "@/lib/products";
import { useProducts } from "@/hooks/useProducts";
import { useDebouncedValue } from "@/components/products/hooks/useDebouncedValue";
import { backendApi } from "@/lib/backend-api";
import type { CashMovementType, CashSession } from "@/lib/api-types";

interface CartItem extends Product {
  quantity: number;
}

export function POSModule() {
  const { addSale } = useTransactions();
  const { currentUser, branchId, setBranchId } = useUser();
  const { businessType } = useBusiness();
  const { branches } = useBranches();
  const { toast } = useToast();

  const canManageCash =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    currentUser?.role === "cashier";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanQuery, setScanQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(
    null
  );
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [isCashLoading, setIsCashLoading] = useState(false);
  const [isCashSaving, setIsCashSaving] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [movementType, setMovementType] = useState<CashMovementType>("IN");
  const [movementReason, setMovementReason] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const debouncedSearch = useDebouncedValue(searchQuery, 250);

  const { products, isLoading } = useProducts({
    take: 30,
    search: debouncedSearch,
    categoryId: selectedCategory === "all" ? null : selectedCategory,
    branchId: selectedBranch === "all" ? null : selectedBranch,
  });

  useEffect(() => {
    if (branchId) {
      setSelectedBranch(branchId);
      return;
    }
    if (branches.length > 0) {
      setSelectedBranch(branches[0].id);
      setBranchId(branches[0].id);
    }
  }, [branchId, branches, setBranchId]);

  const loadCurrentCashSession = async () => {
    if (!canManageCash) {
      setCashSession(null);
      return;
    }

    if (selectedBranch === "all") {
      setCashSession(null);
      return;
    }

    try {
      setIsCashLoading(true);
      const session = await backendApi.cash.getCurrentSession();
      setCashSession(session);
      if (session?.expectedCash !== undefined && session?.expectedCash !== null) {
        setCountedCash(String(session.expectedCash));
      }
    } catch (error: any) {
      setCashSession(null);
      toast({
        variant: "destructive",
        title: "Error de caja",
        description:
          error?.message || "No se pudo obtener el estado actual de caja.",
      });
    } finally {
      setIsCashLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentCashSession();
  }, [selectedBranch, canManageCash]);

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

  const handlePayment = (method: string) => {
    if (cart.length === 0) {
      toast({
        title: "Carrito vacio",
        description: "Agrega productos al carrito antes de procesar el pago",
        variant: "destructive",
      });
      return;
    }

    if (canManageCash && !cashSession) {
      toast({
        variant: "destructive",
        title: "Caja cerrada",
        description: "Debes abrir caja antes de registrar ventas.",
      });
      return;
    }

    setPendingPaymentMethod(method);
    setIsPaymentConfirmOpen(true);
  };

  const processPayment = async () => {
    const method = pendingPaymentMethod || "Efectivo";

    try {
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
        branchId:
          selectedBranch === "all" ? branches[0]?.id || "unknown" : selectedBranch,
        businessType,
      });

      toast({
        title: "Venta exitosa",
        description: `Venta por $${total.toLocaleString()} registrada con ${method}`,
      });
      setCart([]);
      setIsPaymentConfirmOpen(false);
      setPendingPaymentMethod(null);
      if (canManageCash) {
        await loadCurrentCashSession();
      }
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

  const handleOpenCash = async () => {
    const opening = Number(openingFloat);
    if (!Number.isFinite(opening) || opening < 0) return;

    try {
      setIsCashSaving(true);
      const session = await backendApi.cash.openSession({ openingFloat: opening });
      setCashSession(session);
      setOpeningFloat("");
      setCountedCash(String(session.expectedCash ?? ""));
      toast({ title: "Caja abierta", description: "Sesion abierta correctamente." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al abrir caja",
        description: error?.message || "No se pudo abrir caja.",
      });
    } finally {
      setIsCashSaving(false);
    }
  };

  const handleAddMovement = async () => {
    if (!cashSession) return;
    const amount = Number(movementAmount);
    if (!Number.isFinite(amount) || amount < 0.01 || !movementReason.trim()) return;

    try {
      setIsCashSaving(true);
      const updated = await backendApi.cash.addMovement(cashSession.id, {
        type: movementType,
        reason: movementReason.trim(),
        amount,
      });
      setCashSession(updated);
      setMovementAmount("");
      setMovementReason("");
      toast({ title: "Movimiento registrado" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error en movimiento",
        description: error?.message || "No se pudo registrar movimiento.",
      });
    } finally {
      setIsCashSaving(false);
    }
  };

  const handleCloseCash = async () => {
    if (!cashSession) return;
    const counted = Number(countedCash);
    if (!Number.isFinite(counted) || counted < 0) return;

    try {
      setIsCashSaving(true);
      await backendApi.cash.closeSession(cashSession.id, {
        countedCash: counted,
        notes: closeNotes.trim() || undefined,
      });
      setCashSession(null);
      setCountedCash("");
      setCloseNotes("");
      toast({ title: "Caja cerrada", description: "Sesion cerrada correctamente." });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al cerrar caja",
        description: error?.message || "No se pudo cerrar caja.",
      });
    } finally {
      setIsCashSaving(false);
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
                      autoFocus
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
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedBranch(value);
                      if (value !== "all") setBranchId(value);
                    }}
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
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Caja
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!canManageCash && (
                <p className="text-xs text-muted-foreground">
                  Solo admin/manager/cashier pueden gestionar caja.
                </p>
              )}
              {isCashLoading && (
                <div className="text-xs text-muted-foreground">Cargando caja...</div>
              )}
              {!cashSession ? (
                <>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Fondo inicial"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    onClick={handleOpenCash}
                    disabled={!canManageCash || isCashSaving}
                  >
                    {isCashSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Abrir Caja
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-xs rounded-md border p-2 space-y-1">
                    <p>Estado: <strong>{cashSession.status}</strong></p>
                    <p>Fondo inicial: <strong>${Number(cashSession.openingFloat ?? 0).toLocaleString()}</strong></p>
                    <p>Esperado: <strong>${Number(cashSession.expectedCash ?? 0).toLocaleString()}</strong></p>
                  </div>
                  <div className="space-y-2 border rounded-md p-3">
                    <Select value={movementType} onValueChange={(v) => setMovementType(v as CashMovementType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">Ingreso</SelectItem>
                        <SelectItem value="OUT">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" min="0.01" placeholder="Monto" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
                    <Input placeholder="Motivo" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} maxLength={120} />
                    <Button variant="outline" className="w-full" onClick={handleAddMovement} disabled={!canManageCash || isCashSaving}>
                      Registrar Movimiento
                    </Button>
                  </div>
                  <div className="space-y-2 border rounded-md p-3">
                    <Input type="number" step="0.01" min="0" placeholder="Efectivo contado" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
                    <Input placeholder="Notas (opcional)" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} maxLength={600} />
                    <Button className="w-full" onClick={handleCloseCash} disabled={!canManageCash || isCashSaving}>
                      Cerrar Caja
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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
                        <img src={item.brand || "/placeholder.svg"} alt={item.name} className="w-10 h-10 rounded object-cover bg-muted" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">${Number(item.costPrice).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(item.id)}>
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
                    <Button className="w-full" onClick={() => handlePayment("Efectivo")} disabled={isProcessingPayment}>
                      <Banknote className="mr-2 h-4 w-4" />
                      Pagar en Efectivo
                    </Button>
                    <Button className="w-full" variant="outline" onClick={() => handlePayment("Tarjeta")} disabled={isProcessingPayment}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pagar con Tarjeta
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="w-full" variant="ghost">Limpiar Carrito</Button>
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
                          <AlertDialogAction onClick={clearCart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
              Deseas procesar el pago de <strong>${Number(total).toLocaleString()}</strong> usando{" "}
              <strong>{pendingPaymentMethod === "Efectivo" ? "Efectivo" : "Tarjeta"}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPaymentMethod(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={processPayment} className="bg-primary hover:bg-primary/90" disabled={isProcessingPayment}>
              {isProcessingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar y Registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
}

interface CartItem extends Product {
  quantity: number;
}
const mockProducts: Product[] = [
  {
    id: "1",
    name: "Cerveza Rubia",
    price: 4000,
    category: "Cervezas",
    image: "/products/cerveza.jpg",
  },
  {
    id: "2",
    name: "Vino Tinto",
    price: 15000,
    category: "Vinos",
    image: "/products/vino.jpg",
  },
  {
    id: "3",
    name: "Fernet Branca",
    price: 12000,
    category: "Tragos",
    image: "/products/fernet.webp",
  },
  {
    id: "4",
    name: "Vodka",
    price: 12.0,
    category: "Destilados",
    image: "/products/vodka.webp",
  },
  {
    id: "5",
    name: "Gin Tonic",
    price: 9.0,
    category: "Tragos",
    image: "/products/gin.png",
  },
  {
    id: "6",
    name: "Whisky",
    price: 15.0,
    category: "Destilados",
    image: "/products/blue.jpg",
  },
];

export function POSModule() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(mockProducts.map((p) => p.category)));

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
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

  const clearCart = () => {
    setCart([]);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePayment = (method: string) => {
    if (cart.length === 0) {
      toast({
        title: "Carrito vacío",
        description: "Agrega productos al carrito antes de procesar el pago",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Pago procesado",
      description: `Pago de $${total.toFixed(2)} procesado con ${method}`,
    });
    clearCart();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Punto de Venta
          </h1>
          <p className="text-muted-foreground">
            Sistema de ventas rápido y eficiente
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="w-12 h-12 rounded-md object-cover bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {product.category}
                          </p>
                          <p className="font-bold text-sm">
                            ${product.price.toFixed(2)}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart Section */}
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
                <p className="text-center text-muted-foreground py-8">
                  Carrito vacío
                </p>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center space-x-2"
                      >
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          className="w-10 h-10 rounded object-cover bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {item.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            ${item.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
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
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Impuestos:</span>
                      <span>${(total * 0.1).toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>${(total * 1.1).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handlePayment("Efectivo")}
                    >
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
                    <Button
                      className="w-full"
                      variant="ghost"
                      onClick={clearCart}
                    >
                      Limpiar Carrito
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

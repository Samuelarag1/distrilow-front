"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number; // Precio Minorista
    wholesalePrice: number; // Precio Mayorista
    category: string;
    stock: number;
    status: "active" | "inactive";
    image: string;
    minStock?: number;
    maxStock?: number;
    unit?: string;
    branchId: string;
}

interface ProductContextType {
    products: Product[]
    updateStock: (id: string, newStock: number) => void
    adjustStock: (id: string, delta: number) => void
    addProduct: (product: Omit<Product, "id">) => Promise<void>
    updateProduct: (id: string, productData: Partial<Product>) => void
    removeProduct: (id: string) => void
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

const initialProducts: Product[] = [
    // Almacén
    { id: "a1", name: "Alfajor Rasta 70g", description: "Caja/Pack 18u", price: 1000, wholesalePrice: 950, category: "Almacén", stock: 100, minStock: 20, maxStock: 200, unit: "18u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "a2", name: "Alfajor Sol Serrano", description: "Pack 6u", price: 350, wholesalePrice: 300, category: "Almacén", stock: 150, minStock: 30, maxStock: 300, unit: "6u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "a3", name: "Arroz Mandisovi 1kg", description: "Bolsa 1kg", price: 1000, wholesalePrice: 900, category: "Almacén", stock: 80, minStock: 20, maxStock: 200, unit: "10u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "a4", name: "Atún Cumana Aceite 170g", description: "Lata 170g", price: 1400, wholesalePrice: 1250, category: "Almacén", stock: 120, minStock: 48, maxStock: 480, unit: "48u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "a5", name: "Cafe Nescafe Dolca 170g", description: "Doypack 170g", price: 6700, wholesalePrice: 6300, category: "Almacén", stock: 45, minStock: 12, maxStock: 120, unit: "12u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "a6", name: "Fideo Celestial 500g Guisero", description: "Pack 500g", price: 599, wholesalePrice: 579, category: "Almacén", stock: 300, minStock: 60, maxStock: 600, unit: "15u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "a7", name: "Yerba La Hoja 500g", description: "Paquete 500g", price: 1500, wholesalePrice: 1350, category: "Almacén", stock: 180, minStock: 36, maxStock: 360, unit: "12u", status: "active", image: "/placeholder.svg", branchId: "b1" },

    // Aceites
    { id: "ac1", name: "Aceite Natura 900ml", description: "Botella 900ml", price: 3700, wholesalePrice: 3400, category: "Aceites", stock: 120, minStock: 30, maxStock: 300, unit: "15u", status: "active", image: "/placeholder.svg", branchId: "b1" },
    { id: "ac2", name: "Aceite Bidón 9L", description: "Bidón 9L", price: 19500, wholesalePrice: 18500, category: "Aceites", stock: 15, minStock: 5, maxStock: 50, unit: "1u", status: "active", image: "/placeholder.svg", branchId: "b1" },

    // Bebidas
    { id: "b1", name: "Fernet Branca 750cc", description: "Botella 750cc", price: 14000, wholesalePrice: 13000, category: "Bebidas", stock: 48, minStock: 12, maxStock: 120, unit: "6u", status: "active", image: "/placeholder.svg", branchId: "b2" },
    { id: "b2", name: "Energizante Monster", description: "Lata 473ml", price: 2700, wholesalePrice: 2500, category: "Bebidas", stock: 150, minStock: 24, maxStock: 240, unit: "1u", status: "active", image: "/placeholder.svg", branchId: "b2" },
    { id: "b3", name: "Vino Toro tinto 1L", description: "Tetra 1L", price: 2000, wholesalePrice: 1750, category: "Bebidas", stock: 120, minStock: 24, maxStock: 240, unit: "6u", status: "active", image: "/placeholder.svg", branchId: "b2" },

    // Fiambres
    { id: "f1", name: "Jamón Cocido Tirolesa", description: "Horma x Kg", price: 9000, wholesalePrice: 7000, category: "Fiambres", stock: 12, minStock: 3, maxStock: 20, unit: "Horma", status: "active", image: "/placeholder.svg", branchId: "b2" },
    { id: "f2", name: "Salame Bastón Tirolesa", description: "Unidad", price: 12000, wholesalePrice: 10000, category: "Fiambres", stock: 30, minStock: 10, maxStock: 100, unit: "1u", status: "active", image: "/placeholder.svg", branchId: "b2" },

    // Quedos
    { id: "q1", name: "Mozarella La Severina", description: "Horma x Kg", price: 6500, wholesalePrice: 5500, category: "Quesos", stock: 20, minStock: 5, maxStock: 40, unit: "Horma", status: "active", image: "/placeholder.svg", branchId: "b2" },
];

import { useAudit } from "./audit-provider"
import { useUser } from "./user-provider"

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const { logEvent } = useAudit()
    const { token } = useUser()

    const updateStock = (id: string, newStock: number) => {
        const product = products.find(p => p.id === id)
        if (product) {
            logEvent("adjust_stock", "product", `Actualizó stock de ${product.name} a ${newStock} ${product.unit}`, id, { oldStock: product.stock, newStock })
        }
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, newStock) } : p))
    }

    const adjustStock = (id: string, delta: number) => {
        const product = products.find(p => p.id === id)
        if (product) {
            const newStock = Math.max(0, product.stock + delta)
            logEvent("adjust_stock", "product", `${delta > 0 ? "Sumó" : "Restó"} ${Math.abs(delta)} a ${product.name}`, id, { delta, oldStock: product.stock, newStock })
        }
        setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p))
    }

    const addProduct = async (productData: Omit<Product, "id">) => {
        const newProduct: Product = {
            ...productData,
            id: Math.random().toString(36).substr(2, 9),
            wholesalePrice: (productData as any).wholesalePrice || productData.price
        }

        // Llamada a la API para sincronizar el nuevo producto
        try {
            const response = await fetch("http://localhost:3000/api/products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(newProduct),
            });

            if (!response.ok) {
                console.error("Error al sincronizar el producto con la API");
            } else {
                console.log("Producto sincronizado correctamente con la API");
            }
        } catch (error) {
            console.error("Error de red al intentar sincronizar el producto:", error);
        }

        logEvent("create", "product", `Agregó nuevo producto: ${newProduct.name}`, newProduct.id)
        setProducts(prev => [...prev, newProduct])
    }

    const updateProduct = (id: string, productData: Partial<Product>) => {
        const product = products.find(p => p.id === id)
        if (product) {
            logEvent("update", "product", `Modificó detalles de ${product.name}`, id, { productData })
        }
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...productData } : p))
    }

    const removeProduct = (id: string) => {
        const product = products.find(p => p.id === id)
        if (product) {
            logEvent("delete", "product", `Eliminó el producto ${product.name}`, id)
        }
        setProducts(prev => prev.filter(p => p.id !== id))
    }

    return (
        <ProductContext.Provider value={{ products, updateStock, adjustStock, addProduct, updateProduct, removeProduct }}>
            {children}
        </ProductContext.Provider>
    )
}

export function useProducts() {
    const context = useContext(ProductContext)
    if (context === undefined) {
        throw new Error("useProducts must be used within a ProductProvider")
    }
    return context
}

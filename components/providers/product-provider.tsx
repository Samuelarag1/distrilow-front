"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { useAudit } from "./audit-provider"
import { useUser } from "./user-provider"

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
    isLoading: boolean
    updateStock: (id: string, newStock: number) => Promise<void>
    adjustStock: (id: string, delta: number) => Promise<void>
    addProduct: (product: Omit<Product, "id">) => Promise<void>
    updateProduct: (id: string, productData: Partial<Product>) => Promise<void>
    removeProduct: (id: string) => Promise<void>
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const { logEvent } = useAudit()
    const { token } = useUser()

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setIsLoading(true);
                const data = await api.get("/products");
                setProducts(data);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (token) {
            fetchProducts();
        }
    }, [token])

    const updateStock = async (id: string, newStock: number) => {
        const product = products.find(p => p.id === id)
        if (!product) return;

        try {
            await api.put(`/products/${id}/stock`, { stock: Math.max(0, newStock) });

            logEvent("adjust_stock", "product", `Actualizó stock de ${product.name} a ${newStock} ${product.unit}`, id, { oldStock: product.stock, newStock })
            setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, newStock) } : p))
        } catch (error) {
            console.error("Failed to update stock:", error);
        }
    }

    const adjustStock = async (id: string, delta: number) => {
        const product = products.find(p => p.id === id)
        if (!product) return;

        const newStock = Math.max(0, product.stock + delta);

        try {
            await api.put(`/products/${id}/stock`, { stock: newStock });

            logEvent("adjust_stock", "product", `${delta > 0 ? "Sumó" : "Restó"} ${Math.abs(delta)} a ${product.name}`, id, { delta, oldStock: product.stock, newStock })
            setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: newStock } : p))
        } catch (error) {
            console.error("Failed to adjust stock:", error);
        }
    }

    const addProduct = async (productData: Omit<Product, "id">) => {
        try {
            const newProduct = await api.post("/products", productData);

            logEvent("create", "product", `Agregó nuevo producto: ${newProduct.name}`, newProduct.id)
            setProducts(prev => [...prev, newProduct])
        } catch (error) {
            console.error("Error creating product:", error);
            throw error;
        }
    }

    const updateProduct = async (id: string, productData: Partial<Product>) => {
        const product = products.find(p => p.id === id)
        if (!product) return;

        try {
            const updatedProduct = await api.put(`/products/${id}`, productData);

            logEvent("update", "product", `Modificó detalles de ${product.name}`, id, { productData })
            setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedProduct } : p))
        } catch (error) {
            console.error("Error updating product:", error);
        }
    }

    const removeProduct = async (id: string) => {
        const product = products.find(p => p.id === id)
        if (!product) return;

        try {
            await api.delete(`/products/${id}`);

            logEvent("delete", "product", `Eliminó el producto ${product.name}`, id)
            setProducts(prev => prev.filter(p => p.id !== id))
        } catch (error) {
            console.error("Error removing product:", error);
        }
    }

    return (
        <ProductContext.Provider value={{ products, isLoading, updateStock, adjustStock, addProduct, updateProduct, removeProduct }}>
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

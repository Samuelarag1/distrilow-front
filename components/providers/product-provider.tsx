"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    stock: number;
    status: "active" | "inactive";
    image: string;
    minStock?: number;
    maxStock?: number;
    unit?: string;
}

interface ProductContextType {
    products: Product[]
    updateStock: (id: string, newStock: number) => void
    adjustStock: (id: string, delta: number) => void
    addProduct: (product: Omit<Product, "id">) => void
    updateProduct: (id: string, productData: Partial<Product>) => void
    removeProduct: (id: string) => void
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

const initialProducts: Product[] = [
    {
        id: "1",
        name: "Cerveza Rubia",
        description: "Cerveza refrescante, ideal para compartir bien fría.",
        price: 4000,
        category: "Cervezas",
        stock: 30,
        minStock: 10,
        maxStock: 100,
        unit: "botellas",
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
        minStock: 8,
        maxStock: 50,
        unit: "botellas",
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
        minStock: 5,
        maxStock: 30,
        unit: "botellas",
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
        minStock: 6,
        maxStock: 25,
        unit: "botellas",
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
        minStock: 10,
        maxStock: 40,
        unit: "tragos",
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
        minStock: 4,
        maxStock: 20,
        unit: "botellas",
        status: "active",
        image: "/products/blue.jpg",
    },
];

import { useAudit } from "./audit-provider"

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>(initialProducts)
    const { logEvent } = useAudit()

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

    const addProduct = (productData: Omit<Product, "id">) => {
        const newProduct: Product = {
            ...productData,
            id: Math.random().toString(36).substr(2, 9)
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

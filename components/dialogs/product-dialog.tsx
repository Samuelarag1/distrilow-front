"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import { useBranches } from "@/components/providers/branch-provider"

import { useProducts, Product } from "@/components/providers/product-provider"
import { useBusiness } from "@/components/providers/business-provider"

interface ProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSave: (product: Partial<Product>) => void
}

const categories = ["Almacén", "Aceites", "Bebidas", "Fiambres", "Quesos", "Otros"]

export function ProductDialog({ open, onOpenChange, product, onSave }: ProductDialogProps) {
  const { branches } = useBranches();
  const { businessType } = useBusiness();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    wholesalePrice: 0,
    category: "Otros",
    stock: 0,
    minStock: 0,
    maxStock: 100,
    unit: "Unit",
    status: "active" as "active" | "inactive",
    image: "/placeholder.svg?height=100&width=100",
    branchId: "",
  })

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: product.price || 0,
        wholesalePrice: product.wholesalePrice || 0,
        category: product.category || "Otros",
        stock: product.stock || 0,
        minStock: product.minStock || 0,
        maxStock: product.maxStock || 100,
        unit: product.unit || "Unit",
        status: product.status || "active",
        image: product.image || "/placeholder.svg?height=100&width=100",
        branchId: product.branchId || branches[0]?.id || "",
      })
    } else {
      setFormData({
        name: "",
        description: "",
        price: 0,
        wholesalePrice: 0,
        category: "Otros",
        stock: 0,
        minStock: 0,
        maxStock: 100,
        unit: "Unit",
        status: "active",
        image: "/placeholder.svg?height=100&width=100",
        branchId: branches[0]?.id || "",
      })
    }
  }, [product, open, branches])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!formData.name.trim()) return;
    if (formData.price < 0 || formData.wholesalePrice < 0) return;
    if (!formData.branchId) return;

    onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          <DialogDescription>
            {product ? "Modifica los datos del producto" : "Completa la información del nuevo producto"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branchId">Sucursal *</Label>
                <Select
                  value={formData.branchId}
                  onValueChange={(value) => setFormData({ ...formData, branchId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Cerveza IPA 500ml"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles adicionales..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Precio Minorista *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wholesalePrice">Precio Mayorista *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="wholesalePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={formData.wholesalePrice}
                    onChange={(e) => setFormData({ ...formData, wholesalePrice: Number.parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Actual</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: Number.parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: Number.parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidad</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="uds, kg, l"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
              <div className="flex flex-col gap-1">
                <Label htmlFor="status" className="font-bold">Estado del Producto</Label>
                <span className="text-xs text-muted-foreground">Define si aparecerá en el punto de venta</span>
              </div>
              <Switch
                id="status"
                checked={formData.status === "active"}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? "active" : "inactive" })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="font-bold px-8">
              {product ? "Guardar Cambios" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTransactions } from "@/components/providers/transactions-provider"
import { useBusiness } from "@/components/providers/business-provider"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface AddExpenseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AddExpenseDialog({ open, onOpenChange }: AddExpenseDialogProps) {
    const { addExpense } = useTransactions()
    const { businessType } = useBusiness()
    const [isLoading, setIsLoading] = useState(false)

    const [formData, setFormData] = useState({
        amount: "",
        category: "",
        description: ""
    })

    // Predefined categories based on business type
    const categories = businessType === "retail"
        ? ["Servicios", "Mantenimiento", "Suministros", "Alquiler", "Marketing", "Otros"]
        : ["Logística", "Inventario", "Servicios", "Nómina", "Mantenimiento", "Otros"]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.amount || !formData.category || !formData.description) {
            toast.error("Por favor completa todos los campos")
            return
        }

        setIsLoading(true)

        // Simulate network delay for better UX
        await new Promise(resolve => setTimeout(resolve, 600))

        try {
            addExpense({
                amount: Number(formData.amount),
                category: formData.category,
                description: formData.description,
                businessType
            })

            toast.success("Gasto registrado correctamente")
            setFormData({ amount: "", category: "", description: "" })
            onOpenChange(false)
        } catch (error) {
            toast.error("Error al registrar el gasto")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                    <DialogDescription>
                        Ingresa los detalles del gasto para {businessType === "retail" ? "el comercio minorista" : "la distribuidora mayorista"}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto ($)</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="text-lg"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Categoría</Label>
                        <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona una categoría" />
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

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input
                            id="description"
                            placeholder="Ej: Pago de luz"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Registrar Gasto
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

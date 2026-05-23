"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions } from "@/components/providers/transactions-provider";
import { useUser } from "@/components/providers/user-provider";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-categories";
import {
  formatDecimalAmountInput,
  parseDecimalAmountInput,
} from "@/lib/numeric-input";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddExpenseDialog({
  open,
  onOpenChange,
}: AddExpenseDialogProps) {
  const { addExpense } = useTransactions();
  const { branchId, branches } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    amount: "",
    category: "",
    description: "",
  });

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? null,
    [branches, branchId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!branchId) {
      toast({
        variant: "destructive",
        title: "Sucursal requerida",
        description: "Selecciona una sucursal antes de registrar un gasto.",
      });
      return;
    }

    if (!formData.amount || !formData.category || !formData.description) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "Completa todos los campos para registrar el gasto.",
      });
      return;
    }

    setIsLoading(true);

    try {
      await addExpense({
        amount: parseDecimalAmountInput(formData.amount),
        category: formData.category as any,
        description: formData.description,
      });

      toast({
        title: "Gasto registrado",
        description: "El gasto quedo guardado correctamente.",
      });
      setFormData({ amount: "", category: "", description: "" });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos registrar el gasto",
        description: getUserFacingErrorMessage(
          error,
          "Revisa los datos ingresados e intenta nuevamente."
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
          <DialogDescription>
            Ingresa los detalles del gasto para{" "}
            <span className="font-medium">
              {activeBranch?.name ?? "la sucursal seleccionada"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto ($)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  amount: formatDecimalAmountInput(e.target.value),
                })
              }
              className="text-lg"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoria" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_OPTIONS.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripcion</Label>
            <Input
              id="description"
              placeholder="Ej: Pago de luz"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
  );
}

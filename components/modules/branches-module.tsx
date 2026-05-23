"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  MoreHorizontal,
  Edit,
  Trash2,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranches, Branch } from "@/components/providers/branch-provider";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingErrorMessage } from "@/lib/user-feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export function BranchesModule() {
  const { branches, addBranch, updateBranch, removeBranch, isLoading } =
    useBranches();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setIsDialogOpen(true);
  };

  const handleDeleteTrigger = (branchId: string) => {
    setBranchToDelete(branchId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (branchToDelete) {
      try {
        await removeBranch(branchToDelete);
        toast({
          title: "Sucursal eliminada",
          description: "La sucursal ha sido eliminada correctamente.",
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "No pudimos eliminar la sucursal",
          description: getUserFacingErrorMessage(
            error,
            "Verifica que la sucursal no tenga informacion asociada e intenta nuevamente."
          ),
        });
      } finally {
        setIsDeleteDialogOpen(false);
        setBranchToDelete(null);
      }
    }
  };

  const handleSave = async (branchData: Omit<Branch, "id" | "createdAt">) => {
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchData);
        toast({
          title: "Sucursal actualizada",
          description: "Los cambios han sido guardados correctamente.",
        });
      } else {
        await addBranch(branchData);
        toast({
          title: "Sucursal creada",
          description: "La nueva sucursal ha sido agregada correctamente.",
        });
      }
      setIsDialogOpen(false);
      setEditingBranch(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "No pudimos guardar la sucursal",
        description: getUserFacingErrorMessage(
          error,
          "Revisa la informacion cargada e intenta nuevamente."
        ),
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingBranch(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Sucursales
          </h1>
          <p className="text-muted-foreground">
            Gestiona las ubicaciones físicas de tu negocio
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingBranch(null);
            setIsDialogOpen(true);
          }}
          className="w-full sm:w-auto shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva Sucursal
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o dirección..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground col-span-full">
            Cargando sucursales...
          </p>
        )}
        {!isLoading && filteredBranches.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No hay sucursales para mostrar.
          </p>
        )}
        {filteredBranches.map((branch) => (
          <BranchCard
            key={branch.id}
            branch={branch}
            onEdit={handleEdit}
            onDelete={handleDeleteTrigger}
          />
        ))}
      </div>

      <BranchDialog
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        branch={editingBranch}
        onSave={handleSave}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Está seguro de eliminar esta sucursal?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán los registros
              asociados a esta sucursal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BranchCard({
  branch,
  onEdit,
  onDelete,
}: {
  branch: Branch;
  onEdit: (b: Branch) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-t-4 border-t-primary/20 hover:border-t-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{branch.name}</CardTitle>
            <Badge
              variant={branch.isActive ? "default" : "secondary"}
              className={`${
                branch.isActive
                  ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-gray-500 text-white"
              } text-[10px] uppercase font-black tracking-widest mt-1`}
            >
              {branch.isActive ? "Activa" : "Inactiva"}
            </Badge>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(branch)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(branch.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 text-primary/60" />
          <span>{branch.address}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4 text-primary/60" />
          <span>{branch.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4 text-primary/60" />
          <span>{branch.email}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface BranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
  onSave: (branch: Omit<Branch, "id" | "createdAt">) => void;
}

const BRANCH_FORM_INITIAL_STATE: Omit<Branch, "id" | "createdAt"> = {
  name: "",
  address: "",
  phone: "",
  email: "",
  isActive: true,
  branchType: "STORE",
  code: "",
};

function BranchDialog({
  open,
  onOpenChange,
  branch,
  onSave,
}: BranchDialogProps) {
  const [formData, setFormData] = useState<Omit<Branch, "id" | "createdAt">>(
    BRANCH_FORM_INITIAL_STATE
  );

  useEffect(() => {
    if (!open) return;

    if (branch) {
      setFormData({
        code: branch.code,
        name: branch.name,
        address: branch.address,
        phone: branch.phone ?? "",
        email: branch.email ?? "",
        isActive: branch.isActive,
        branchType: branch.branchType,
      });
      return;
    }

    setFormData(BRANCH_FORM_INITIAL_STATE);
  }, [branch, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {branch ? "Editar Sucursal" : "Nueva Sucursal"}
          </DialogTitle>
          <DialogDescription>
            {branch
              ? "Modifica los datos de la sucursal"
              : "Agrega una nueva sucursal al sistema"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la Sucursal</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Sucursal Centro"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Identificador de Suc.</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="Ej: SUC-001"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Ej: Av. Siempreviva 742"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branchType">Tipo de Sucursal</Label>
                <Select
                  value={formData.branchType}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                    branchType: value as Branch["branchType"],
                  })
                }
              >
                <SelectTrigger id="branchType" className="w-full">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent defaultValue={"Tipos de Sucursal"}>
                  {/* <SelectLabel>Tipos de Sucursal</SelectLabel> */}
                  <SelectItem value="STORE">Tienda</SelectItem>
                  <SelectItem value="WAREHOUSE">Almacén</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="isActive">Estado</Label>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="space-y-1">
                  <Badge
                    variant={formData.isActive ? "default" : "secondary"}
                    className={
                      formData.isActive ? "bg-emerald-600 text-white" : ""
                    }
                  >
                    {formData.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    {formData.isActive
                      ? "Disponible para operar"
                      : "No disponible para operar"}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-slate-300"
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="Ej: 555-1234"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="sucursal@ejemplo.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {branch ? "Guardar Cambios" : "Crear Sucursal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

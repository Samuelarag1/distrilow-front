// components/products/components/SearchInput.tsx
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchInput(props: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar productos por nombre o descripción..."
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="pl-8"
        disabled={props.disabled}
      />
    </div>
  );
}

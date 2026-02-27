// components/products/components/SortButton.tsx
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { SortKey, SortOrder } from "../types/Product";

export function SortButton(props: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  order: SortOrder;
  onClick: (key: SortKey) => void;
  disabled?: boolean;
}) {
  const isActive = props.activeKey === props.sortKey;

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      className="h-8 text-xs font-medium"
      onClick={() => props.onClick(props.sortKey)}
      disabled={props.disabled}
    >
      {props.label}
      {isActive ? (
        props.order === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );
}

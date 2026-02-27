// components/products/components/BranchSelect.tsx
import { setApiSession } from "@/lib/api-client";

export function BranchSelect(props: {
  value: string;
  branches: Array<{ id: string; name: string }> | undefined;
  token: string | null;
  onChange: (branchId: string) => void;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => {
        const id = e.target.value;
        if (!id) return;
        props.onChange(id);
        if (props.token) setApiSession(props.token, id);
        document.cookie = `activeBranchId=${id}; path=/`;
      }}
      className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Seleccionar sucursal…</option>
      {props.branches?.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

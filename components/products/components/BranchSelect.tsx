export function BranchSelect(props: {
  value: string;
  branches: Array<{ id: string; name: string }> | undefined;
  onChange: (branchId: string) => Promise<void> | void;
}) {
  return (
    <select
      value={props.value}
      onChange={async (e) => {
        const id = e.target.value;
        if (!id) return;
        await props.onChange(id);
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

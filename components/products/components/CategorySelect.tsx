// components/products/components/CategorySelect.tsx
export function CategorySelect(props: {
  value: string;
  categories: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className="px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      disabled={props.disabled}
    >
      <option value="all">Todas las categorías</option>
      {props.categories.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}

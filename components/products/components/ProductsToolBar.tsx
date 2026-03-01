// components/products/components/ProductsToolbar.tsx
import { SearchInput } from "./SearchInput";
import { CategorySelect } from "./CategorySelect";
import { BranchSelect } from "./BranchSelect";

export function ProductsToolbar(props: {
  activeBranchId: string | null;
  searchQuery: string;
  onSearchChange: (v: string) => void;

  selectedCategory: string;
  categories: Array<{ value: string; label: string }>;
  onCategoryChange: (v: string) => void;

  branchId: string | null;
  branches: Array<{ id: string; name: string }> | undefined;
  onBranchChange: (id: string) => Promise<void> | void;
}) {
  const disabled = !props.activeBranchId;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <SearchInput
        value={props.searchQuery}
        onChange={props.onSearchChange}
        disabled={disabled}
      />

      <CategorySelect
        value={props.selectedCategory}
        categories={props.categories}
        onChange={props.onCategoryChange}
        disabled={disabled}
      />

      <BranchSelect
        value={props.branchId ?? ""}
        branches={props.branches}
        onChange={props.onBranchChange}
      />
    </div>
  );
}

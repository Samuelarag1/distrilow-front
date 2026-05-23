import { BrandSpinner } from "@/components/common/brand-spinner";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background/80 backdrop-blur-sm">
      <BrandSpinner size="lg" label="Cargando..." />
    </div>
  );
}

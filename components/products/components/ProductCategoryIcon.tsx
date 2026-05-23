import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  Apple,
  Beef,
  Beer,
  Candy,
  Carrot,
  ChefHat,
  Coffee,
  CupSoda,
  Fish,
  Ham,
  Milk,
  Package,
  Sandwich,
  Soup,
  Wheat,
  Wine,
} from "lucide-react"

type CategoryVisualRule = {
  keywords: string[]
  icon: LucideIcon
  classes: string
}

const CATEGORY_ICON_RULES: CategoryVisualRule[] = [
  {
    keywords: ["fiambre", "fiambres", "embutido", "chacinado", "jamon"],
    icon: Ham,
    classes: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    keywords: ["carn", "pollo", "vacuno", "res", "cerdo"],
    icon: Beef,
    classes: "bg-red-50 text-red-700 border-red-200",
  },
  {
    keywords: ["pesc", "marisco", "mar"],
    icon: Fish,
    classes: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    keywords: ["lacteo", "lacteos", "leche", "queso", "yogur", "yogurt"],
    icon: Milk,
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    keywords: ["fruta", "verdura", "hortaliza", "vegetal"],
    icon: Apple,
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    keywords: ["pan", "panader", "harina", "grano"],
    icon: Wheat,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    keywords: ["snack", "golosina", "dulce", "caramelo", "galleta"],
    icon: Candy,
    classes: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  },
  {
    keywords: ["cafe", "cafeter"],
    icon: Coffee,
    classes: "bg-stone-50 text-stone-700 border-stone-200",
  },
  {
    keywords: ["gaseosa", "bebida", "agua", "jugo", "refresco"],
    icon: CupSoda,
    classes: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    keywords: ["cerveza", "birra"],
    icon: Beer,
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    keywords: ["vino"],
    icon: Wine,
    classes: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    keywords: ["comida", "preparado", "plato", "cocina"],
    icon: ChefHat,
    classes: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    keywords: ["sopa", "caldo", "congelado"],
    icon: Soup,
    classes: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    keywords: ["sandwich", "sanguche"],
    icon: Sandwich,
    classes: "bg-lime-50 text-lime-700 border-lime-200",
  },
  {
    keywords: ["verdul", "zanahoria"],
    icon: Carrot,
    classes: "bg-orange-50 text-orange-700 border-orange-200",
  },
]

const DEFAULT_ICON = {
  icon: Package,
  classes: "bg-slate-100 text-slate-700 border-slate-200",
}

function normalizeCategory(input?: string) {
  if (!input) return ""
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function resolveCategoryVisual(category?: string) {
  const normalized = normalizeCategory(category)
  const matchedRule = CATEGORY_ICON_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword))
  )
  return matchedRule ?? DEFAULT_ICON
}

export function ProductCategoryIcon(props: {
  category?: string
  className?: string
  iconClassName?: string
}) {
  const { category, className, iconClassName } = props
  const visual = resolveCategoryVisual(category)
  const Icon = visual.icon

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border",
        visual.classes,
        className
      )}
      title={category || "Sin categoria"}
      aria-label={category || "Sin categoria"}
    >
      <Icon className={cn("h-6 w-6", iconClassName)} aria-hidden="true" />
    </div>
  )
}

"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function Header() {
  const { setTheme, theme } = useTheme();

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 md:hidden" />
        <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-3 py-1 text-xs font-medium text-muted-foreground sm:flex">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>DistriLow</span>
        </div>
      </div>

      <div className="ml-auto flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </div>
    </header>
  );
}

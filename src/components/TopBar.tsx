import { Moon, Sun, Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/pos": "Point of Sale",
  "/inventory": "Inventory",
  "/purchases": "Purchases",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/reports": "Reports & Analytics",
  "/settings": "Settings",
};

export function TopBar() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const title = titles[pathname] ?? "ApexRx";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="flex flex-col leading-tight">
        <h1 className="text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        <p className="hidden text-xs text-muted-foreground md:block">Manage your pharmacy with precision</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, patients, bills…"
            className="h-9 w-64 rounded-lg border-border/60 bg-muted/40 pl-9 text-sm focus-visible:ring-primary lg:w-80"
          />
        </div>
        <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Notifications">
          <Bell className="h-[18px] w-[18px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>
      </div>
    </header>
  );
}

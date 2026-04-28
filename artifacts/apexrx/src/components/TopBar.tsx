import { Moon, Sun, Search, LogOut, KeyRound, UserCog, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { Input } from "@/components/ui/input";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/pos": "Point of Sale",
  "/inventory": "Inventory",
  "/purchases": "Purchases",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/reports": "Reports",
  "/settings": "Settings",
  "/admin/users": "Users & Access",
  "/account/security": "Account Security",
};

export function TopBar() {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const { user, username, role, logout } = useAuth();
  const navigate = useNavigate();
  const title = titles[pathname] ?? "ApexRx";

  const onLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/login", { replace: true });
  };

  const initial = (user?.fullName ?? username ?? "U").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ApexRx
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            className="h-8 w-56 rounded-md border-border bg-card pl-8 pr-12 text-[13px] focus-visible:ring-1 focus-visible:ring-primary lg:w-72"
          />
          <span className="kbd pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">⌘K</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="mx-1 hidden h-5 w-px bg-border md:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 rounded-md px-1.5 hover:bg-muted"
              aria-label="Account"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {initial}
              </span>
              <span className="hidden text-[13px] font-medium md:inline">
                {user?.fullName ?? username ?? "User"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <div className="text-[13px] font-semibold">{user?.fullName ?? username ?? "User"}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="pill bg-success-soft text-success">{role ?? "guest"}</span>
                <span>· Signed in</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account/security">
                <KeyRound className="mr-2 h-3.5 w-3.5" /> Security & sessions
              </Link>
            </DropdownMenuItem>
            {role === "admin" && (
              <DropdownMenuItem asChild>
                <Link to="/admin/users">
                  <UserCog className="mr-2 h-3.5 w-3.5" /> Users & access
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

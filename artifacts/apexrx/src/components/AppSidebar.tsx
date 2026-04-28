import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  Building2,
  BarChart3,
  Settings,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";

type NavItem = { title: string; url: string; icon: any; roles?: Role[]; shortcut?: string };

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, shortcut: "D" },
  { title: "Point of Sale", url: "/pos", icon: ShoppingCart, shortcut: "S" },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["admin", "manager"], shortcut: "I" },
  { title: "Purchases", url: "/purchases", icon: Truck, roles: ["admin", "manager"], shortcut: "P" },
];
const peopleItems: NavItem[] = [
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Suppliers", url: "/suppliers", icon: Building2, roles: ["admin", "manager"] },
];
const systemItems: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ["admin", "manager"] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ["admin"] },
  { title: "Users & Access", url: "/admin/users", icon: ShieldCheck, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useAuth();

  const visible = (items: NavItem[]) =>
    items.filter((i) => !i.roles || (role && i.roles.includes(role)));

  const renderItems = (items: NavItem[]) => (
    <SidebarMenu>
      {visible(items).map((item) => {
        const active = pathname === item.url;
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild tooltip={item.title}>
              <NavLink
                to={item.url}
                end
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                )}
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.title}</span>
                  </>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <span className="font-mono text-[13px] font-bold text-primary-foreground">Rx</span>
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight">ApexRx</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Pharmacy Console
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Workspace
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderItems(mainItems)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Directory
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>{renderItems(peopleItems)}</SidebarGroupContent>
        </SidebarGroup>
        {visible(systemItems).length > 0 && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                System
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>{renderItems(systemItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/40 px-2.5 py-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-[11px] font-medium capitalize text-sidebar-accent-foreground">
                {role ?? "guest"} session
              </span>
              <span className="text-[10px] text-muted-foreground">All systems operational</span>
            </div>
            <Activity className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ) : (
          <div className="mx-auto h-1.5 w-1.5 rounded-full bg-success" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

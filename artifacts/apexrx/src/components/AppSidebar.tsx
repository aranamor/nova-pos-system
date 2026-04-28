import {
  LayoutDashboard, ShoppingCart, Package, Truck, Users, Building2,
  BarChart3, Settings, Pill, ShieldCheck,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";

type NavItem = { title: string; url: string; icon: any; roles?: Role[] };

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Point of Sale", url: "/pos", icon: ShoppingCart },
  { title: "Inventory", url: "/inventory", icon: Package, roles: ["admin", "manager"] },
  { title: "Purchases", url: "/purchases", icon: Truck, roles: ["admin", "manager"] },
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
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-glow font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary-foreground")} />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold gradient-text leading-tight">Nova POS</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pharmacy Console</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>{renderItems(mainItems)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">Directory</SidebarGroupLabel>}
          <SidebarGroupContent>{renderItems(peopleItems)}</SidebarGroupContent>
        </SidebarGroup>
        {visible(systemItems).length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">System</SidebarGroupLabel>}
            <SidebarGroupContent>{renderItems(systemItems)}</SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {!collapsed ? (
          <div className="rounded-lg bg-sidebar-accent/60 p-3 text-xs">
            <div className="font-semibold text-sidebar-accent-foreground capitalize">{role ?? "guest"} session</div>
            <div className="text-muted-foreground mt-0.5">All systems operational</div>
          </div>
        ) : (
          <div className="mx-auto h-2 w-2 rounded-full bg-success animate-pulse" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

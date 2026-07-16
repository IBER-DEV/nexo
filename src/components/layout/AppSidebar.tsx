import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListTodo,
  CalendarRange,
  KanbanSquare,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";
import { NexoMark } from "@/components/brand/NexoMark";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/AuthProvider";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Actividades", url: "/activities", icon: ListTodo },
  { title: "Planeación", url: "/planeacion", icon: CalendarRange, planningAccess: true },
  { title: "Kanban", url: "/kanban", icon: KanbanSquare },
  { title: "Reportes", url: "/reports", icon: BarChart3, planningAccess: true },
  { title: "Usuarios", url: "/users", icon: Users, adminOnly: true },
  { title: "Configuración", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, canAccessPlanning } = useAuth();
  const visibleItems = items.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.planningAccess) return canAccessPlanning;
    return true;
  });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 flex-row items-center border-b border-sidebar-border p-0">
        <Link to="/" className="flex h-full items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <NexoMark color="white" className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold font-display">Nexo</span>
            <span className="text-[11px] text-muted-foreground">Gestión TI</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
        v1.0 · Nexo TI
      </SidebarFooter>
    </Sidebar>
  );
}

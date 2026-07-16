import { useEffect, useState, type FormEvent } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Moon, Sun, Search, LogOut, User as UserIcon, Bell, Settings } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

export function Topbar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const searchQ = useRouterState({
    select: (s) =>
      s.location.pathname === "/activities" ? ((s.location.search as { q?: string }).q ?? "") : "",
  });

  const [query, setQuery] = useState(searchQ);

  useEffect(() => {
    setQuery(searchQ);
  }, [searchQ]);
  const initials = user?.iniciales ?? (user?.nombre ?? "U").slice(0, 2).toUpperCase();

  const submitSearch = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate({ to: "/activities", search: { q: trimmed } });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger />
      <form
        onSubmit={submitSearch}
        className="relative hidden md:block w-72 shrink-0"
        role="search"
      >
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Buscar actividades..."
          className="pl-8 h-9 w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar actividades"
        />
      </form>
      <div className="flex-1 min-w-0" />
      <div className="flex items-center gap-1 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notificaciones">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No hay notificaciones pendientes.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Cambiar tema"
          data-cuelume-toggle
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2 max-w-[200px]">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-sm truncate">
                {user?.nombre ?? user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium leading-none">{user?.nombre}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" /> Mi perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

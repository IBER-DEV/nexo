import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NexoLoader } from "@/components/brand/NexoLoader";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// Matches the loader's own animation loop (styles.css, nexo-loader-*) so it
// always plays through at least one full cycle instead of flashing away —
// isAuthenticated resolves synchronously from localStorage, so without this
// the loader would otherwise be on screen for a single frame.
const MIN_SPLASH_MS = 2400;

function AppLayout() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [ready, setReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && minTimeElapsed) {
      setReady(true);
    }
  }, [isAuthenticated, minTimeElapsed]);

  if (!ready) {
    return <NexoLoader />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 flex-1">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div key={pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

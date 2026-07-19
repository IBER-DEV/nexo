import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NexoLoader } from "@/components/brand/NexoLoader";
import { EmailVerificationBanner } from "@/components/layout/EmailVerificationBanner";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { WorkspaceProvider, useWorkspace } from "@/providers/WorkspaceProvider";

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
    <WorkspaceProvider>
      <WorkspaceGate pathname={pathname} />
    </WorkspaceProvider>
  );
}

// Los maestros (estados/prioridades/tipos) son datos que el resto del layout
// asume disponibles de forma síncrona (badges, Kanban, formularios) — se
// esperan aquí, antes de montar la app, en vez de manejar `undefined` en
// cada consumidor.
function WorkspaceGate({ pathname }: { pathname: string }) {
  const { isLoading } = useWorkspace();

  if (isLoading) {
    return <NexoLoader />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 flex-1">
          <EmailVerificationBanner />
          <Topbar />
          <main className="relative flex-1 p-4 md:p-6 lg:p-8">
            {/* Glow ambiental — la misma firma visual del pulso del dashboard,
                presente en cada página como constante de marca. */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden"
              aria-hidden="true"
            >
              <div
                className="ambient-glow absolute -top-24 -right-20 h-80 w-80 rounded-full blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
                }}
              />
            </div>
            <div key={pathname} className="relative z-10 animate-fade-in">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

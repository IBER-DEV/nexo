import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export function DemoModeBanner() {
  const { user } = useAuth();

  if (!user?.is_demo_readonly) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-b border-border/60 bg-primary/10 px-4 py-2 text-sm text-primary">
      <Eye className="h-4 w-4 shrink-0" />
      <span>Estás en la demo pública — solo lectura, los cambios no se guardan.</span>
      <Link to="/signup" className="font-medium underline-offset-2 hover:underline">
        Crea tu propio espacio →
      </Link>
    </div>
  );
}

import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/AuthProvider";
import { authService } from "@/services/authService";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

export function EmailVerificationBanner() {
  const { user } = useAuth();

  const resend = useMutation({
    mutationFn: authService.resendVerification,
    onSuccess: (data) => toast.success(data.detail),
    onError: (err) => {
      const detail =
        err instanceof ApiError
          ? ((err.data as Record<string, unknown> | null)?.detail as string | undefined)
          : undefined;
      toast.error(detail ?? "No se pudo reenviar el correo");
    },
  });

  if (!user || user.email_verified) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-b border-border/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      <Mail className="h-4 w-4 shrink-0" />
      <span>Confirma tu correo para asegurar tu cuenta.</span>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-amber-700 dark:text-amber-400"
        disabled={resend.isPending}
        onClick={() => resend.mutate()}
      >
        {resend.isPending ? "Enviando..." : "Reenviar"}
      </Button>
    </div>
  );
}

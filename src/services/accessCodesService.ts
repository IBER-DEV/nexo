import { apiFetch } from "@/lib/api";
import type { AccessCode, UserRole } from "@/lib/types";

export interface AccessCodeInput {
  rol: UserRole;
  expires_at?: string | null;
  max_usos?: number | null;
}

export interface ResolvedAccessCode {
  organization_nombre: string;
  rol: UserRole;
}

export const accessCodesService = {
  list: () => apiFetch<AccessCode[]>("/access-codes/"),
  create: (input: AccessCodeInput) =>
    apiFetch<AccessCode>("/access-codes/", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setActive: (id: number, is_active: boolean) =>
    apiFetch<AccessCode>(`/access-codes/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active }),
    }),
  remove: (id: number) => apiFetch<void>(`/access-codes/${id}/`, { method: "DELETE" }),
  resolve: (codigo: string) =>
    apiFetch<ResolvedAccessCode>(
      `/auth/access-codes/resolve/?codigo=${encodeURIComponent(codigo)}`,
    ),
};

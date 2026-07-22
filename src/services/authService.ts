import { apiFetch } from "@/lib/api";
import type { OrganizationDetail, User } from "@/lib/types";

export interface SignupTemplate {
  key: string;
  display_name: string;
  description: string;
  recommended_for: string[];
}

/** Dos modos mutuamente excluyentes: fundar una organización nueva
 * (nombre_org + template) o unirse a una existente con un código. */
export type SignupInput =
  | { email: string; password: string; nombre: string; nombre_org: string; template: string }
  | { email: string; password: string; nombre: string; access_code: string };

export interface SignupResult {
  access: string;
  refresh: string;
  user: User;
  organization: OrganizationDetail;
}

/** Demo pública de solo lectura: sin credenciales, un solo POST. 404 si la
 * instancia no la tiene configurada (self-hosted no la expone por defecto).
 * Un usuario por rol — deja ver la interacción real, no una preview. */
export type DemoRole = "owner" | "admin" | "coordinator" | "member";

export interface DemoLoginResult {
  access: string;
  refresh: string;
  user: User;
}

export const authService = {
  templates: () => apiFetch<SignupTemplate[]>("/auth/signup/templates/"),
  signup: (input: SignupInput) =>
    apiFetch<SignupResult>("/auth/signup/", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  demoLogin: (role?: DemoRole) =>
    apiFetch<DemoLoginResult>("/auth/demo-login/", {
      method: "POST",
      body: JSON.stringify(role ? { role } : {}),
    }),
  verifyEmail: (token: string) =>
    apiFetch<{ detail: string }>(`/auth/email/verify/?token=${encodeURIComponent(token)}`),
  resendVerification: () => apiFetch<{ detail: string }>("/auth/email/resend/", { method: "POST" }),
  forgotPassword: (email: string) =>
    apiFetch<{ detail: string }>("/auth/password/forgot/", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (input: { uid: string; token: string; new_password: string }) =>
    apiFetch<{ detail: string }>("/auth/password/reset/", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

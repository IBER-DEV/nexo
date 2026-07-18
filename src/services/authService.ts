import { apiFetch } from "@/lib/api";
import type { OrganizationDetail, User } from "@/lib/types";

export interface SignupTemplate {
  key: string;
  display_name: string;
  description: string;
  recommended_for: string[];
}

export interface SignupInput {
  email: string;
  password: string;
  nombre: string;
  nombre_org: string;
  template: string;
}

export interface SignupResult {
  access: string;
  refresh: string;
  user: User;
  organization: OrganizationDetail;
}

export const authService = {
  templates: () => apiFetch<SignupTemplate[]>("/auth/signup/templates/"),
  signup: (input: SignupInput) =>
    apiFetch<SignupResult>("/auth/signup/", {
      method: "POST",
      body: JSON.stringify(input),
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

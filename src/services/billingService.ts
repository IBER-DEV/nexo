import { apiFetch } from "@/lib/api";

export type AccessLevel = "full" | "read_only" | "blocked";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired";

export interface Subscription {
  id: number;
  status: SubscriptionStatus;
  provider_status: string;
  plan: string;
  effective_plan: string;
  access_level: AccessLevel;
  quantity: number;
  trial_ends_at: string | null;
  trial_expired: boolean;
  renews_at: string | null;
  ends_at: string | null;
  customer_portal_url: string;
  update_payment_url: string;
  created_at: string;
}

export interface BillingState {
  /** false en self-hosted: la instancia no tiene proveedor de pagos y nada gatea el acceso. */
  billing_enabled: boolean;
  plan: string;
  access_level: AccessLevel;
  subscription: Subscription | null;
  trial_available: boolean;
  trial_days: number;
  can_manage: boolean;
}

export const billingService = {
  state: () => apiFetch<BillingState>("/billing/"),
  checkout: () =>
    apiFetch<{ url: string; checkout_id: string }>("/billing/checkout/", { method: "POST" }),
  startTrial: () => apiFetch<Subscription>("/billing/trial/", { method: "POST" }),
  portal: () => apiFetch<{ url: string; stale: boolean }>("/billing/portal/"),
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Periodo de prueba",
  active: "Activa",
  past_due: "Pago vencido",
  paused: "Pausada",
  cancelled: "Cancelada",
  expired: "Expirada",
};

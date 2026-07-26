import { apiFetch } from "@/lib/api";

export type TokenScope = "read" | "read_write";

export interface AccessToken {
  id: number;
  nombre: string;
  /** Prefijo visible ("nxo_ab12cd34") — el valor completo solo existe al crearlo. */
  prefix: string;
  scope: TokenScope;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  is_usable: boolean;
  is_expired: boolean;
}

/** Única respuesta que incluye `token`: el valor en claro no vuelve a estar disponible. */
export interface AccessTokenCreated extends AccessToken {
  token: string;
}

export interface AccessTokenInput {
  nombre: string;
  scope: TokenScope;
  expires_at?: string | null;
}

export const tokensService = {
  list: () => apiFetch<AccessToken[]>("/auth/tokens/"),
  create: (input: AccessTokenInput) =>
    apiFetch<AccessTokenCreated>("/auth/tokens/", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  revoke: (id: number) => apiFetch<void>(`/auth/tokens/${id}/`, { method: "DELETE" }),
};

export const TOKEN_SCOPE_LABEL: Record<TokenScope, string> = {
  read: "Solo lectura",
  read_write: "Lectura y escritura",
};

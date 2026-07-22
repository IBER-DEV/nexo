import { toast } from "sonner";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";

const ACCESS_KEY = "flowdesk-access";
const REFRESH_KEY = "flowdesk-refresh";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function tryRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = (await res.json()) as { access: string };
    localStorage.setItem(ACCESS_KEY, data.access);
    return data.access;
  } catch {
    return null;
  }
}

function buildHeaders(token: string | null, extra?: HeadersInit, isFormData = false): HeadersInit {
  return {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = getAccessToken();
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const doRequest = (t: string | null) =>
    fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(t, options.headers, isFormData),
    });

  let res = await doRequest(token);

  if (res.status === 401) {
    token = await tryRefresh();
    if (!token) {
      clearTokens();
      window.dispatchEvent(new Event("auth:logout"));
      throw new ApiError(401, null, "UNAUTHORIZED");
    }
    res = await doRequest(token);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      ((data as Record<string, unknown>)?.detail as string | undefined) ?? "Error en la petición";
    // Ningún call-site de escritura (Kanban drag, ActivityForm, etc.) atrapa
    // el ApiError con un toast propio — sin esto, un 403 de la demo pública
    // falla en silencio y el usuario no entiende por qué "no pasó nada".
    if (res.status === 403) toast.error(message);
    throw new ApiError(res.status, data, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

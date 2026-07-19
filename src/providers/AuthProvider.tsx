import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setTokens, clearTokens, getAccessToken } from "@/lib/api";
import type { User } from "@/lib/types";
import { usersService } from "@/services/usersService";
import { authService, type SignupInput } from "@/services/authService";

interface AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCoordinator: boolean;
  canAccessPlanning: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthState>({
  isAuthenticated: false,
  isAdmin: false,
  isCoordinator: false,
  canAccessPlanning: false,
  user: null,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
});

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";
const USER_KEY = "flowdesk-user";

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const qc = useQueryClient();
  const isAuthenticated = !!user && !!getAccessToken();
  const isAdmin = user?.rol === "admin" || user?.rol === "owner";
  const isCoordinator = user?.rol === "coordinator";
  const canAccessPlanning = isAdmin || isCoordinator;

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
      // Sin esto, React Query sigue sirviendo (workspace, actividades,
      // usuarios...) del usuario/organización anterior hasta que cada query
      // refetchee por su cuenta — con staleTime: Infinity en workspace,
      // eso podía no pasar nunca sin un refresh manual.
      qc.clear();
    };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, [qc]);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    usersService
      .me()
      .then((fresh) => {
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(fresh));
        setUser(fresh);
      })
      .catch(() => {
        if (!cancelled) {
          clearTokens();
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        ((err as Record<string, unknown>)?.detail as string | undefined) ??
          "Credenciales inválidas",
      );
    }
    const data = (await res.json()) as { access: string; refresh: string; user: User };
    qc.clear(); // descarta cualquier caché de una sesión/organización anterior
    setTokens(data.access, data.refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const signup = async (input: SignupInput) => {
    const data = await authService.signup(input);
    qc.clear(); // descarta cualquier caché de una sesión/organización anterior
    setTokens(data.access, data.refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    clearTokens();
    localStorage.removeItem(USER_KEY);
    setUser(null);
    qc.clear();
  };

  return (
    <AuthCtx.Provider
      value={{
        isAuthenticated,
        isAdmin,
        isCoordinator,
        canAccessPlanning,
        user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

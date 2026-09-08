"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Client-side auth state, hydrated from the HttpOnly session cookie via
 * /api/auth/me. The cookie itself is never readable from JS — the server
 * remains the single source of truth.
 */

export interface ClientUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  permissions: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

interface AuthContextValue {
  user: ClientUser | null;
  /** True until the initial /api/auth/me round-trip resolves. */
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<ClientUser>;
  register: (email: string, name: string | undefined, password: string) => Promise<ClientUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export class AuthRequestError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new AuthRequestError(0, "No se pudo conectar con el servidor.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; retryAfterSeconds?: number };
    throw new AuthRequestError(
      res.status,
      err.error ?? "Ocurrió un error inesperado.",
      err.retryAfterSeconds,
    );
  }
  return data as T;
}

interface MeResponse {
  user: ClientUser | null;
}
interface AuthResponse {
  user: ClientUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await requestJson<MeResponse>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await requestJson<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (email: string, name: string | undefined, password: string) => {
      const data = await requestJson<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name, password }),
      });
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}

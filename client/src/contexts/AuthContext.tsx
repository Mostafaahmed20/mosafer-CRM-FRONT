import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  _id: string;
  username: string;
  email: string;
  role?: string;
  canViewAllAnalytics?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "";

export class AuthApiError extends Error {
  code?: string;
  recoveryUrl?: string;
  email?: string;
  status?: number;

  constructor(
    message: string,
    options?: { code?: string; recoveryUrl?: string; email?: string; status?: number }
  ) {
    super(message);
    this.name = "AuthApiError";
    this.code = options?.code;
    this.recoveryUrl = options?.recoveryUrl;
    this.email = options?.email;
    this.status = options?.status;
  }
}

export function isAuthApiError(error: unknown): error is AuthApiError {
  return error instanceof AuthApiError;
}

function pickStringPath(input: unknown, path: string[]): string | undefined {
  let current: unknown = input;
  for (const segment of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current !== "string") return undefined;
  const value = current.trim();
  return value || undefined;
}

async function throwAuthError(response: Response, fallbackMessage: string): Promise<never> {
  const body = await response.json().catch(() => null);

  const message =
    pickStringPath(body, ["message"]) ||
    pickStringPath(body, ["error"]) ||
    pickStringPath(body, ["details", "message"]) ||
    fallbackMessage;
  const code =
    pickStringPath(body, ["code"]) ||
    pickStringPath(body, ["errorCode"]) ||
    pickStringPath(body, ["details", "code"]);
  const recoveryUrl =
    pickStringPath(body, ["recoveryUrl"]) ||
    pickStringPath(body, ["data", "recoveryUrl"]) ||
    pickStringPath(body, ["details", "recoveryUrl"]);
  const email =
    pickStringPath(body, ["email"]) ||
    pickStringPath(body, ["data", "email"]) ||
    pickStringPath(body, ["details", "email"]);

  throw new AuthApiError(message, {
    code,
    recoveryUrl,
    email,
    status: response.status,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) await throwAuthError(response, "Login failed");

    const data = await response.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const loginWithGoogle = async (idToken: string) => {
    const response = await fetch(`${API_URL}/api/users/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) await throwAuthError(response, "Google login failed");

    const data = await response.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) await throwAuthError(response, "Registration failed");
  };

  const verifyEmail = async (tokenValue: string) => {
    const response = await fetch(`${API_URL}/api/users/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenValue }),
    });
    if (!response.ok) await throwAuthError(response, "Email verification failed");
  };

  const resendVerification = async (email: string) => {
    const response = await fetch(`${API_URL}/api/users/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) await throwAuthError(response, "Failed to resend verification email");
  };

  const requestPasswordReset = async (email: string) => {
    const response = await fetch(`${API_URL}/api/users/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) await throwAuthError(response, "Failed to send reset email");
  };

  const resetPassword = async (tokenValue: string, password: string) => {
    const response = await fetch(`${API_URL}/api/users/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenValue, password }),
    });
    if (!response.ok) await throwAuthError(response, "Failed to reset password");
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithGoogle,
        register,
        verifyEmail,
        resendVerification,
        requestPasswordReset,
        resetPassword,
        logout,
        isLoading,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

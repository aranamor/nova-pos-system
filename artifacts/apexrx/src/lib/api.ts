// Thin API client for the ApexRx Express backend.
// Uses session cookies + CSRF double-submit.

const BASE = (import.meta.env.VITE_API_BASE as string) || "/api";

export type Role = "admin" | "manager" | "cashier";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  role: Role;
  status: "active" | "disabled";
  emailVerified: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// CSRF token cache (set when /me responds; also kept in cookie for resilience)
let csrfToken: string | null = null;
export function setCsrfToken(t: string | null) {
  csrfToken = t;
}
function readCsrfFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)apexrx\.csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const tok = csrfToken ?? readCsrfFromCookie();
    if (tok) headers["X-CSRF-Token"] = tok;
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  let payload: unknown = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = await res.text();
    } catch {
      payload = null;
    }
  }
  if (!res.ok) {
    const isAuthEndpoint =
      path === "/login" ||
      path === "/me" ||
      path === "/logout" ||
      path.startsWith("/forgot-password") ||
      path.startsWith("/reset-password");
    if (res.status === 401 && !isAuthEndpoint && onUnauthorized) {
      onUnauthorized();
    }
    const msg =
      (typeof payload === "object" &&
        payload &&
        ((payload as Record<string, unknown>).error as string)) ||
      (typeof payload === "object" &&
        payload &&
        ((payload as Record<string, unknown>).message as string)) ||
      `Request failed (${res.status})`;
    throw new ApiError(String(msg), res.status, payload);
  }
  return payload as T;
}

export interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
}

export interface AuditEntry {
  id: number;
  userId: number | null;
  username: string | null;
  event: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
}

export const api = {
  // ---- Auth ----
  me: () =>
    request<{ loggedIn: boolean; user?: AuthUser; csrfToken?: string }>("/me"),
  login: (username: string, password: string) =>
    request<{ success: boolean; user?: AuthUser; message?: string }>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  signup: (body: { username: string; email: string; fullName?: string; password: string }) =>
    request<{ success: boolean; user?: AuthUser; message?: string }>("/signup", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  logout: () => request<{ success: boolean }>("/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string; devToken?: string }>(
      "/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
    ),
  resetPassword: (token: string, password: string) =>
    request<{ success: boolean; message: string }>("/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>("/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  sessions: () => request<SessionInfo[]>("/sessions"),
  revokeSession: (id: string) =>
    request<{ success: boolean }>(`/sessions/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
    }),
  auditLog: (limit = 100) => request<AuditEntry[]>(`/audit-log?limit=${limit}`),
  users: () => request<AuthUser[]>("/users"),
  updateUser: (id: number, body: Partial<{ role: Role; status: "active" | "disabled"; fullName: string | null }>) =>
    request<{ success: boolean }>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  adminResetPassword: (id: number) =>
    request<{ success: boolean; tempPassword: string }>(
      `/users/${id}/reset-password`,
      { method: "POST" },
    ),

  // ---- Dashboard ----
  dashboardStats: () => request<any>("/dashboard-stats"),

  // ---- Products ----
  products: (status?: "Available" | "NotAvailable" | "All", q?: string) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (q) qs.set("q", q);
    const s = qs.toString();
    return request<any[]>(`/products${s ? `?${s}` : ""}`);
  },
  product: (id: number | string) => request<any>(`/products/${id}`),
  productSearch: (q: string) =>
    request<any[]>(`/products/search?q=${encodeURIComponent(q)}`),
  productBatches: (id: number | string) =>
    request<any[]>(`/products/${id}/batches`),
  inventoryFlat: (q: string) =>
    request<any[]>(`/inventory${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createProduct: (body: any) =>
    request<{ id: number; message: string }>("/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProduct: (id: any, body: any) =>
    request<{ message: string }>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteProduct: (id: any) =>
    request<{ message: string }>(`/products/${id}`, { method: "DELETE" }),
  stockAdjust: (body: any) =>
    request<{ message: string }>("/stock-adjustments", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ---- Customers ----
  customers: () => request<any[]>("/customers"),
  customer: (id: any) => request<any>(`/customers/${id}`),
  customerHistory: (id: any) => request<any[]>(`/customers/${id}/history`),
  createCustomer: (body: any) =>
    request<{ id: number; message: string }>("/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCustomer: (id: any, body: any) =>
    request<{ message: string }>(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCustomer: (id: any) =>
    request<{ message: string }>(`/customers/${id}`, { method: "DELETE" }),

  // ---- Suppliers ----
  suppliers: () => request<any[]>("/suppliers"),
  createSupplier: (body: any) =>
    request<{ id: number; message: string }>("/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSupplier: (id: any, body: any) =>
    request<{ message: string }>(`/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSupplier: (id: any) =>
    request<{ message: string }>(`/suppliers/${id}`, { method: "DELETE" }),

  // ---- Settings ----
  settings: () => request<Record<string, string | number>>("/settings"),
  saveSettings: (body: any) =>
    request<{ message: string }>("/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ---- Bills ----
  bills: () => request<any[]>("/bills"),
  heldBills: () => request<any[]>("/held-bills"),
  bill: (id: any) => request<any>(`/bills/${id}`),
  createBill: (body: any) =>
    request<{ id: number; bill_number: string; message: string }>("/bills", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBill: (id: any, body: any) =>
    request<{ message: string }>(`/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteBill: (id: any) =>
    request<{ message: string }>(`/bills/${id}`, { method: "DELETE" }),

  // ---- Purchases ----
  purchases: () => request<any[]>("/purchases"),
  purchase: (id: any) => request<any>(`/purchases/${id}`),
  createPurchase: (body: any) =>
    request<{ id: number; message: string }>("/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePurchase: (id: any, body: any) =>
    request<{ message: string }>(`/purchases/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // ---- Reports ----
  report: (type: string, fromDate: string, toDate: string, compliance?: string) => {
    const qs = new URLSearchParams({ type, fromDate, toDate });
    if (compliance && compliance !== "none") qs.set("compliance", compliance);
    return request<any[]>(`/reports?${qs.toString()}`);
  },
};

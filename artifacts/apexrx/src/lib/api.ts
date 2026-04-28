// Thin API client for the ApexRx Express backend.
// Uses session cookies. On 401, redirects to /login.

const BASE = (import.meta.env.VITE_API_BASE as string) || "/api";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
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
    const isAuthEndpoint = path === "/login" || path === "/me" || path === "/logout";
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

export const api = {
  // Auth
  me: () => request<{ loggedIn: boolean; username: string | null }>("/me"),
  login: (username: string, password: string) =>
    request<{ success: boolean; username?: string; message?: string }>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ success: boolean }>("/logout", { method: "POST" }),

  // Dashboard
  dashboardStats: () => request<any>("/dashboard-stats"),

  // Products (catalog)
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

  // Customers
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

  // Suppliers
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

  // Settings
  settings: () => request<Record<string, string | number>>("/settings"),
  saveSettings: (body: any) =>
    request<{ message: string }>("/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Bills
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

  // Purchases
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

  // Reports
  report: (type: string, fromDate: string, toDate: string, compliance?: string) => {
    const qs = new URLSearchParams({ type, fromDate, toDate });
    if (compliance && compliance !== "none") qs.set("compliance", compliance);
    return request<any[]>(`/reports?${qs.toString()}`);
  },
};

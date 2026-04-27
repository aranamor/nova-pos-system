// Thin API client. Talks to your Express backend at VITE_API_BASE (default '/api').
// In Lovable preview the backend isn't reachable, so each call falls back to
// realistic mock data. Swap VITE_API_BASE to your server URL in production.

import { mockData } from "./mock-data";

const BASE = (import.meta.env.VITE_API_BASE as string) || "/api";

async function request<T>(path: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error(`API ${path} unreachable`);
  }
}

export const api = {
  // Dashboard
  dashboardStats: () => request("/dashboard-stats", {}, mockData.dashboardStats),
  // Products
  products: () => request<any[]>("/products", {}, mockData.products),
  product: (id: number | string) => request<any>(`/products/${id}`, {}, mockData.products[0]),
  createProduct: (body: any) => request("/products", { method: "POST", body: JSON.stringify(body) }, { id: Date.now() }),
  updateProduct: (id: any, body: any) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(body) }, { ok: true }),
  deleteProduct: (id: any) => request(`/products/${id}`, { method: "DELETE" }, { ok: true }),
  stockAdjust: (body: any) => request("/stock-adjustments", { method: "POST", body: JSON.stringify(body) }, { ok: true }),
  // Customers
  customers: () => request<any[]>("/customers", {}, mockData.customers),
  customer: (id: any) => request(`/customers/${id}`, {}, mockData.customers[0]),
  customerHistory: (id: any) => request<any[]>(`/customers/${id}/history`, {}, mockData.customerHistory),
  createCustomer: (body: any) => request("/customers", { method: "POST", body: JSON.stringify(body) }, { id: Date.now() }),
  updateCustomer: (id: any, body: any) => request(`/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }, { ok: true }),
  deleteCustomer: (id: any) => request(`/customers/${id}`, { method: "DELETE" }, { ok: true }),
  // Suppliers
  suppliers: () => request<any[]>("/suppliers", {}, mockData.suppliers),
  // Settings
  settings: () => request<Record<string, string>>("/settings", {}, mockData.settings),
  saveSettings: (body: any) => request("/settings", { method: "POST", body: JSON.stringify(body) }, { ok: true }),
  // Bills
  bills: () => request<any[]>("/bills", {}, mockData.bills),
  heldBills: () => request<any[]>("/held-bills", {}, mockData.bills.filter(b => b.status === "Hold")),
  bill: (id: any) => request(`/bills/${id}`, {}, mockData.bills[0]),
  createBill: (body: any) => request("/bills", { method: "POST", body: JSON.stringify(body) }, { id: Date.now(), bill_number: `INV-${Date.now()}` }),
  updateBill: (id: any, body: any) => request(`/bills/${id}`, { method: "PUT", body: JSON.stringify(body) }, { ok: true }),
  deleteBill: (id: any) => request(`/bills/${id}`, { method: "DELETE" }, { ok: true }),
  // Purchases
  purchases: () => request<any[]>("/purchases", {}, mockData.purchases),
  purchase: (id: any) => request(`/purchases/${id}`, {}, mockData.purchases[0]),
  createPurchase: (body: any) => request("/purchases", { method: "POST", body: JSON.stringify(body) }, { id: Date.now() }),
  updatePurchase: (id: any, body: any) => request(`/purchases/${id}`, { method: "PUT", body: JSON.stringify(body) }, { ok: true }),
  // Reports
  report: (type: string, from: string, to: string) =>
    request<any[]>(`/reports?type=${type}&from=${from}&to=${to}`, {}, mockData.reportsByType(type)),
};

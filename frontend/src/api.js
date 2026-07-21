// Always relative -- in dev, Vite's proxy (see vite.config.js) forwards
// these to the backend; in production, Caddy does the same. Either way,
// the browser only ever sees one origin, which keeps the session cookie
// working correctly.
const API_BASE = "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // sends/receives the session cookie
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

// FastAPI's own HTTPException(...) calls return detail as a plain string,
// but Pydantic validation errors (422s, e.g. from a field validator
// raising ValueError) return detail as an array of error objects instead.
// This normalizes both into one clean, readable message.
function extractErrorMessage(data) {
  if (!data?.detail) return "Request failed";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail[0]?.msg) {
    // Pydantic prefixes custom validator messages with "Value error, "
    return data.detail[0].msg.replace(/^Value error,\s*/, "");
  }
  return "Request failed";
}

export const api = {
  // Auth
  login: (username, password) => request(`/auth/login`, { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request(`/auth/logout`, { method: "POST" }),
  checkAuth: () => request(`/auth/me`),

  // Customers
  searchCustomers: (q) => request(`/customers?search=${encodeURIComponent(q)}`),
  createCustomer: (body) => request(`/customers`, { method: "POST", body: JSON.stringify(body) }),
  updateCustomer: (id, body) => request(`/customers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: "DELETE" }),

  // Services / Products
  listServices: () => request(`/services`),
  listProducts: () => request(`/products`),
  createProduct: (body) => request(`/products`, { method: "POST", body: JSON.stringify(body) }),

  // Orders
  listOrders: (status) => request(`/orders${status ? `?status=${status}` : ""}`),
  getOrder: (id) => request(`/orders/${id}`),
  createOrder: (body) => request(`/orders`, { method: "POST", body: JSON.stringify(body) }),
  updateOrderItems: (id, items) => request(`/orders/${id}/items`, { method: "PUT", body: JSON.stringify(items) }),
  startOrder: (id) => request(`/orders/${id}/start`, { method: "PATCH" }),
  markReady: (id) => request(`/orders/${id}/mark-ready`, { method: "PATCH" }),
  cancelReady: (id) => request(`/orders/${id}/cancel-ready`, { method: "PATCH" }),
  sendNotification: (id) => request(`/orders/${id}/send-notification`, { method: "POST" }),
  revertReady: (id) => request(`/orders/${id}/revert-ready`, { method: "PATCH" }),
  pickupOrder: (id) => request(`/orders/${id}/pickup`, { method: "PATCH" }),
  cancelOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),
  uncancelOrder: (id) => request(`/orders/${id}/uncancel`, { method: "PATCH" }),

  // Analytics
  analyticsSummary: (weeks = 8) => request(`/analytics/summary?weeks=${weeks}`),
};
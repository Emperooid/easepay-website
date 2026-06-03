import { ApiResponse } from '@/types';

const BASE_URL = 'https://easepay-backend.onrender.com/api';

type SubListener = () => void;
const _subListeners: SubListener[] = [];
export const subscriptionExpiredEvent = {
  emit: () => _subListeners.forEach(fn => fn()),
  subscribe: (fn: SubListener): (() => void) => {
    _subListeners.push(fn);
    return () => { const i = _subListeners.indexOf(fn); if (i >= 0) _subListeners.splice(i, 1); };
  },
};

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

function setToken(token: string) {
  localStorage.setItem('authToken', token);
}

function removeToken() {
  localStorage.removeItem('authToken');
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 403 && (data.code === 'TRIAL_EXPIRED' || data.code === 'SUBSCRIPTION_EXPIRED' || data.code === 'SUBSCRIPTION_REQUIRED')) {
      subscriptionExpiredEvent.emit();
      return { success: false, message: data.message, code: data.code, data: null as T };
    }
    return { success: false, message: data.message || `HTTP ${res.status}`, error: data.error, errors: data.errors, code: data.code };
  }

  return data;
}

// Auth
export const sendOTP = (email: string, phone: string) =>
  request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email, phone }) });

export const verifyOTP = async (email: string, phone: string, otp: string) => {
  const res = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, phone, otp }) });
  if (res.success && res.token) setToken(res.token);
  return res;
};

export const signIn = async (identifier: string, password: string) => {
  const res = await request('/auth/signin', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  if (res.success && res.token) setToken(res.token);
  return res;
};

export const checkUserStatus = async (identifier: string) => {
  const res = await request('/auth/check-user-status', { method: 'POST', body: JSON.stringify({ email: identifier }) });
  if (res.success && res.token) setToken(res.token);
  return res;
};

export const requestPasswordReset = (email: string) =>
  request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

export const resetPassword = (data: any) =>
  request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });

export const setupPassword = (password: string) =>
  request('/auth/setup-password', { method: 'POST', body: JSON.stringify({ password, confirmPassword: password }) });

export const setupPin = (pin: string) =>
  request('/auth/setup-pin', { method: 'POST', body: JSON.stringify({ pin, confirmPin: pin }) });

export const getCurrentUser = () => request('/auth/me');

export const logout = () => { removeToken(); };

export const completeOnboarding = (data: any) =>
  request('/auth/complete-onboarding', { method: 'POST', body: JSON.stringify(data) });

// Dashboard
export const getDashboardHome = () => request(`/dashboard/home?_t=${Date.now()}`);
export const getDashboardOverview = (timeframe: 'week' | 'month' | 'year' = 'month') =>
  request(`/dashboard/overview?timeframe=${timeframe}&_t=${Date.now()}`);
export const getDashboardSalesAnalytics = () => request(`/dashboard/sales-analytics?_t=${Date.now()}`);
export const getDashboardExpenseAnalytics = () => request(`/dashboard/expense-analytics?_t=${Date.now()}`);

// Sales
export const getSales = (params: { page?: number; limit?: number; startDate?: string; endDate?: string } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/sales${qs ? `?${qs}` : ''}`);
};
export const getSale = (id: string) => request(`/sales/${id}`);
export const deleteSale = (id: string) => request(`/sales/${id}`, { method: 'DELETE' });
export const createSale = (data: { amount: number; paymentMethod: 'CASH' | 'CARD' | 'TRANSFER'; items: any[] }) =>
  request('/sales', { method: 'POST', body: JSON.stringify(data) });

// Expenses
export const getExpenses = (params: { category?: string; page?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/expenses${qs ? `?${qs}` : ''}`);
};
export const getExpense = (id: string) => request(`/expenses/${id}`);
export const createExpense = (data: any) => request('/expenses', { method: 'POST', body: JSON.stringify(data) });
export const updateExpense = (id: string, data: any) => request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteExpense = (id: string) => request(`/expenses/${id}`, { method: 'DELETE' });
export const getExpenseCategories = () => request('/expenses/categories');

// Inventory
export const getInventory = (params: { page?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/inventory${qs ? `?${qs}&_t=${Date.now()}` : `?_t=${Date.now()}`}`);
};
export const getInventorySummary = () => request('/inventory/summary');
export const createProduct = (data: any) => request('/inventory', { method: 'POST', body: JSON.stringify(data) });
export const updateProduct = (id: string, data: any) => request(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProduct = (id: string) => request(`/inventory/${id}`, { method: 'DELETE' });
export const adjustStock = (id: string, adjustment: { quantityChange: number; reason?: string; type?: string }) =>
  request(`/inventory/${id}/stock`, { method: 'PATCH', body: JSON.stringify(adjustment) });
export const importInventory = (items: any[]) =>
  request('/inventory/import', { method: 'POST', body: JSON.stringify({ items }) });

// Invoices
export const getInvoices = (params: { status?: string; page?: number; limit?: number } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/invoices${qs ? `?${qs}` : ''}`);
};
export const getInvoice = (id: string) => request(`/invoices/${id}`);
export const getNextInvoiceNumber = () => request('/invoices/next-number');
export const createInvoice = (data: any) => request('/invoices', { method: 'POST', body: JSON.stringify(data) });
export const updateInvoice = (id: string, data: any) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const updateInvoiceStatus = (id: string, status: string) =>
  request(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const deleteInvoice = (id: string) => request(`/invoices/${id}`, { method: 'DELETE' });
export const sendInvoice = (id: string) => request(`/invoices/${id}/send`, { method: 'POST' });
export const getInvoiceDownloadLink = (id: string) => request(`/invoices/${id}/download-link`);

// Reports
export const getSalesReport = (params: any = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/reports/sales${qs ? `?${qs}` : ''}`);
};
export const getExpensesReport = (params: any = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/reports/expenses${qs ? `?${qs}` : ''}`);
};
export const getProfitLossReport = (params: any = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
  return request(`/reports/profit-loss${qs ? `?${qs}` : ''}`);
};

// Tax
export const getTaxSummary = (year?: string, quarter?: string) => {
  const sq = [year && `year=${year}`, quarter && `quarter=${quarter}`].filter(Boolean);
  return request(`/tax/summary${sq.length ? `?${sq.join('&')}` : ''}`);
};
export const getMonthlyTax = (month?: string, year?: string) => {
  const sq = [month && `month=${month}`, year && `year=${year}`].filter(Boolean);
  return request(`/tax/monthly${sq.length ? `?${sq.join('&')}` : ''}`);
};
export const getQuarterlyTax = (year: string, quarter: string) => request(`/tax/quarterly/${year}/${quarter}`);
export const getAnnualTax = (year: string) => request(`/tax/annual/${year}`);

// Business
export const getBusinessProfile = () => request('/business/profile/enhanced');
export const updateBusinessProfile = (data: any) =>
  request('/business/profile/enhanced', { method: 'PUT', body: JSON.stringify(data) });
export const saveBusinessOnboarding = (data: any) =>
  request('/business/onboarding', { method: 'POST', body: JSON.stringify(data) });
export const getBalanceSettings = () => request('/business/settings/balance');
export const saveBalanceSettings = (cashBalance: number, bankBalance: number) =>
  request('/business/settings/balance', { method: 'PUT', body: JSON.stringify({ cashBalance, bankBalance }) });

// Staff
export const getTeamMembers = () => request('/business/staff');
export const inviteTeamMember = (email: string, role: string, phone?: string, permissions?: string[], roleId?: string) => {
  const payload: any = { email, role, phone, permissions, roleId };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  return request('/business/staff/invite', { method: 'POST', body: JSON.stringify(payload) });
};
export const removeTeamMember = (userId: string) => request(`/business/staff/${userId}`, { method: 'DELETE' });
export const updateStaffPermissions = (staffId: string, permissions: string[], role?: string) => {
  const payload: any = { permissions };
  if (role) payload.role = role;
  return request(`/business/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(payload) });
};
export const getInvitations = () => request('/invitations');
export const resendInvite = (id: string) => request(`/invitations/${id}/resend`, { method: 'POST' });
export const revokeInvite = (id: string) => request(`/invitations/${id}`, { method: 'DELETE' });

// Settings
export const getSettings = () => request('/settings');
export const updateSettings = (settings: any) =>
  request('/settings', { method: 'PUT', body: JSON.stringify(settings) });

// Subscriptions
export const getSubscriptionPlans = () => request('/subscriptions/plans');
export const getMySubscription = () => request('/subscriptions/status');
export const initializeSubscriptionPayment = (payload: { planName: string; interval: 'monthly' | 'yearly'; redirectUrl?: string }) =>
  request('/subscriptions/initialize', { method: 'POST', body: JSON.stringify(payload) });
export const verifySubscriptionPayment = (payload: { transaction_id: string; tx_ref: string }) =>
  request('/subscriptions/verify', { method: 'POST', body: JSON.stringify(payload) });
export const cancelSubscription = () => request('/subscriptions/cancel', { method: 'POST' });

// Notifications
export const getNotifications = () => request('/notifications');
export const markNotificationRead = (id: string) => request(`/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => request('/notifications/read-all', { method: 'POST' });

// Upload
export const uploadImage = async (file: File): Promise<string> => {
  const token = getToken();
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.imageUrl;
};

export const isAuthenticated = () => !!getToken();
export const getToken_ = getToken;

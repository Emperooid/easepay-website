export interface User {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: 'OWNER' | 'STAFF' | 'ADMIN' | 'CASHIER' | 'MANAGER' | 'ACCOUNTANT';
  phoneVerified: boolean;
  businessOnboarded?: boolean;
  businessName?: string;
  permissions?: string[];
  staffRole?: string;
  businessId?: string;
  avatar?: string;
  profileImage?: string;
  subscription?: { planName?: string; status?: string; interval?: string };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
  data?: T;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  error?: string;
  userStatus?: 'new' | 'verified_no_password' | 'complete';
  requiresPinSetup?: boolean;
}

export interface SaleItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  amount: number;
  description?: string;
  paymentMethod: string;
  items?: SaleItem[];
  customer?: string;
  customerName?: string;
  createdAt: string;
  date?: string;
  type?: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paymentMethod?: string;
  vatAmount?: number;
  vendor?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  costPrice: number;
  unit?: string;
  color?: string;
  description?: string;
  lowStockThreshold?: number;
  createdAt?: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  invoiceDate: string;
  dueDate?: string;
  paymentMethod: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  vatRate?: number;
  vatAmount?: number;
  grandTotal: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'DRAFT' | 'UNPAID' | 'PARTIAL PAYMENT' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

export interface DashboardData {
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
  totalSales?: number;
  recentTransactions?: any[];
  salesData?: any[];
  expenseData?: any[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
}

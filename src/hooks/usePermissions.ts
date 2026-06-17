import { useAuth } from '@/context/AuthContext';

export type PermKey =
  | 'manage_expenses'
  | 'manage_invoices'
  | 'manage_sales'
  | 'manage_stocks'
  | 'view_tax'
  | 'change_pin'
  | 'biometric_auth'
  | 'view_reports'
  | 'manage_business'
  | 'export_data'
  | 'import_data'
  | 'view_transactions';

export function usePermissions() {
  const { user } = useAuth();
  const roleUpper = user?.role?.toUpperCase?.() ?? '';
  const isOwner = !user || roleUpper === 'OWNER' || roleUpper === 'ADMIN';
  const can = (perm: PermKey | string): boolean => isOwner || (user?.permissions ?? []).includes(perm);
  return { isOwner, can };
}

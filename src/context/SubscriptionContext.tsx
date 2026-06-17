'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getMySubscription } from '@/services/apiService';
import { isAuthenticated } from '@/services/apiService';

// ─── Plan tiers ───────────────────────────────────────────────────────────────
export type PlanTier = 'FREE' | 'BASIC' | 'BUSINESS';

// ─── Feature gate keys ────────────────────────────────────────────────────────
export type FeatureKey =
  | 'csvExport'
  | 'staffInvite'
  | 'unlimitedStaff'
  | 'taxSummary'
  | 'businessHealth'
  | 'whatsappSharing'
  | 'multiCurrency'
  | 'stockAlerts'
  | 'advancedAnalytics'
  | 'customInvoiceTemplate'
  | 'prioritySupport';

const FEATURE_GATES: Record<FeatureKey, PlanTier[]> = {
  csvExport:             ['BASIC', 'BUSINESS'],
  staffInvite:           ['BASIC', 'BUSINESS'],
  taxSummary:            ['BASIC', 'BUSINESS'],
  businessHealth:        ['BASIC', 'BUSINESS'],
  whatsappSharing:       ['BASIC', 'BUSINESS'],
  multiCurrency:         ['BASIC', 'BUSINESS'],
  stockAlerts:           ['BASIC', 'BUSINESS'],
  unlimitedStaff:        ['BUSINESS'],
  advancedAnalytics:     ['BUSINESS'],
  customInvoiceTemplate: ['FREE', 'BASIC', 'BUSINESS'],
  prioritySupport:       ['BUSINESS'],
};

// ─── Plan definitions (local fallback, same as mobile) ────────────────────────
export interface PlanDefinition {
  id: string;
  tier: PlanTier;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    tier: 'FREE',
    name: 'Free Trial',
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: '30 days full access, no card required.',
    features: [
      'Full access to all features for 30 days',
      'Sales, invoices, expenses & stock',
      'Tax summary & VAT report',
      'Reports & CSV export',
      'Owner account only',
      'Standard invoice templates',
    ],
  },
  {
    id: 'basic',
    tier: 'BASIC',
    name: 'Basic',
    monthlyPrice: 3000,
    yearlyPrice: 31500,
    description: 'For growing businesses that need more records and team support.',
    highlighted: true,
    features: [
      'Up to 1,500 sales records/month',
      'Up to 1,500 invoices/month',
      'WhatsApp & Email invoice sharing',
      'Up to 6 staff members',
      'Tax summary & VAT report',
      'Full report + CSV export',
      'Business Health Score',
      'Stock taking (up to 500)',
      'Multi-currency support',
      'Low stock alert',
    ],
  },
  {
    id: 'business',
    tier: 'BUSINESS',
    name: 'Business',
    monthlyPrice: 7500,
    yearlyPrice: 78750,
    description: 'Full power for established businesses with a large team.',
    features: [
      'Up to 5,000 sales records/month',
      'Up to 5,000 invoices/month',
      'Up to 20 staff members',
      'Customised invoice templates',
      'WhatsApp, Email, PDF & Terms invoicing',
      'Advanced analytics dashboard',
      'Priority customer support',
      'Tax summary & VAT report',
      'Full report + CSV export',
      'Business Health Score',
      'Stock taking (up to 1,500)',
    ],
  },
];

export type SubscriptionStatus = 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'CANCELLED' | 'FREE';

export interface SubscriptionState {
  tier: PlanTier;
  status: SubscriptionStatus;
  planName: string;
  expiresAt: string | null;
  gracePeriodEnd: string | null;
  trialExpiresAt: string | null;
  interval: 'MONTHLY' | 'YEARLY' | null;
  isLoaded: boolean;
}

interface SubscriptionContextProps extends SubscriptionState {
  refresh: () => Promise<void>;
  resetToFree: () => void;
  can: (feature: FeatureKey) => boolean;
  isTrialExpired: boolean;
  trialDaysLeft: number | null;
  isTransactionBlocked: boolean;
}

const STORAGE_TIER   = 'subscriptionTier';
const STORAGE_EXPIRY = 'subscriptionExpiresAt';

const SubscriptionContext = createContext<SubscriptionContextProps>({
  tier: 'FREE', status: 'FREE', planName: 'Free Trial',
  expiresAt: null, gracePeriodEnd: null, trialExpiresAt: null,
  interval: null, isLoaded: false,
  refresh: async () => {}, resetToFree: () => {},
  can: () => true, isTrialExpired: false, trialDaysLeft: null, isTransactionBlocked: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    tier: 'FREE', status: 'FREE', planName: 'Free Trial',
    expiresAt: null, gracePeriodEnd: null, trialExpiresAt: null,
    interval: null, isLoaded: false,
  });

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined' || !isAuthenticated()) {
      setState(prev => ({ ...prev, isLoaded: true }));
      return;
    }

    // Load from localStorage immediately
    try {
      const cachedTier   = localStorage.getItem(STORAGE_TIER) as PlanTier | null;
      const cachedExpiry = localStorage.getItem(STORAGE_EXPIRY);
      if (cachedTier && cachedTier !== 'FREE' && cachedExpiry && new Date(cachedExpiry) > new Date()) {
        setState(prev => ({ ...prev, tier: cachedTier, status: 'ACTIVE', expiresAt: cachedExpiry, isLoaded: true }));
      } else {
        setState(prev => ({ ...prev, isLoaded: true }));
      }
    } catch { setState(prev => ({ ...prev, isLoaded: true })); }

    // Validate with server
    try {
      const res = await getMySubscription();
      const payload: any = (res as any).data ?? (res as any).subscription ?? (res as any).subscriptionData ?? res;

      const rawStatus: string = (res as any).status ?? payload.status ?? '';
      const rawName: string   =
        (res as any).planName ?? payload.planName ?? payload.plan?.name ?? payload.name ?? 'Free Trial';

      // Normalize tier
      const nameLower = rawName.toLowerCase();
      const tier: PlanTier =
        nameLower.includes('business') ? 'BUSINESS' :
        nameLower.includes('basic')    ? 'BASIC'    : 'FREE';

      // Normalize status
      const statusMap: Record<string, SubscriptionStatus> = {
        active: 'ACTIVE', grace: 'GRACE', expired: 'EXPIRED',
        cancelled: 'CANCELLED', free: 'FREE',
      };
      const status: SubscriptionStatus = statusMap[rawStatus.toLowerCase()] ?? 'FREE';

      const expiresAt: string | null       = payload.expiresAt ?? payload.currentPeriodEnd ?? (res as any).expiresAt ?? null;
      const gracePeriodEnd: string | null  = payload.gracePeriodEnd ?? null;
      const trialExpiresAt: string | null  = payload.trialExpiresAt ?? payload.trialEndDate ?? null;
      const interval: 'MONTHLY' | 'YEARLY' | null =
        payload.interval?.toUpperCase() === 'YEARLY' ? 'YEARLY' :
        payload.interval?.toUpperCase() === 'MONTHLY' ? 'MONTHLY' : null;

      // Cache valid paid plan
      if (tier !== 'FREE' && expiresAt) {
        localStorage.setItem(STORAGE_TIER, tier);
        localStorage.setItem(STORAGE_EXPIRY, expiresAt);
      } else {
        localStorage.removeItem(STORAGE_TIER);
        localStorage.removeItem(STORAGE_EXPIRY);
      }

      setState({ tier, status, planName: rawName, expiresAt, gracePeriodEnd, trialExpiresAt, interval, isLoaded: true });
    } catch { setState(prev => ({ ...prev, isLoaded: true })); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const resetToFree = useCallback(() => {
    localStorage.removeItem(STORAGE_TIER);
    localStorage.removeItem(STORAGE_EXPIRY);
    setState({ tier: 'FREE', status: 'FREE', planName: 'Free Trial', expiresAt: null, gracePeriodEnd: null, trialExpiresAt: null, interval: null, isLoaded: true });
  }, []);

  const can = useCallback((feature: FeatureKey): boolean => {
    if (state.status === 'GRACE' || state.status === 'EXPIRED' || state.status === 'CANCELLED') return false;
    const allowed = FEATURE_GATES[feature] ?? [];
    return allowed.includes(state.tier);
  }, [state.tier, state.status]);

  // Trial logic
  const now = Date.now();
  const trialMs     = state.trialExpiresAt ? new Date(state.trialExpiresAt).getTime() : null;
  const isTrialExpired  = state.tier === 'FREE' && trialMs !== null && trialMs < now;
  const trialDaysLeft   = state.tier === 'FREE' && trialMs !== null && trialMs >= now
    ? Math.ceil((trialMs - now) / (1000 * 60 * 60 * 24)) : null;
  const isTransactionBlocked = isTrialExpired || state.status === 'EXPIRED';

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh, resetToFree, can, isTrialExpired, trialDaysLeft, isTransactionBlocked }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

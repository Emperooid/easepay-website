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

    // Load from localStorage immediately so UI is never blank
    try {
      const cachedTier   = localStorage.getItem(STORAGE_TIER) as PlanTier | null;
      const cachedExpiry = localStorage.getItem(STORAGE_EXPIRY);
      if (cachedTier && cachedTier !== 'FREE' && cachedExpiry && new Date(cachedExpiry) > new Date()) {
        setState(prev => ({ ...prev, tier: cachedTier, status: 'ACTIVE', expiresAt: cachedExpiry, isLoaded: true }));
      } else {
        setState(prev => ({ ...prev, isLoaded: true }));
      }
    } catch { setState(prev => ({ ...prev, isLoaded: true })); }

    // Validate with server (mirrors mobile SubscriptionContext)
    try {
      const res = await getMySubscription();
      const payload: any = (res as any).data ?? (res as any).subscription ?? (res as any).subscriptionData ?? res;

      const rawStatus: string = (res as any).status ?? payload.status ?? '';
      const rawName: string   =
        (res as any).planName ?? payload.planName ?? payload.plan?.name ?? payload.name ?? 'Free Trial';

      // Prefer explicit tier field from backend, fall back to plan name
      const rawTierField: string = (res as any).tier ?? payload.tier ?? '';
      const upper = (rawTierField || rawName).toUpperCase().trim();
      const tier: PlanTier =
        upper.includes('BUSINESS') ? 'BUSINESS' :
        upper.includes('BASIC')    ? 'BASIC'    : 'FREE';

      const planLabel = rawName || (tier === 'BUSINESS' ? 'Business' : tier === 'BASIC' ? 'Basic' : 'Free Trial');

      const statusUpper = rawStatus.toUpperCase().trim();
      const statusMap: Record<string, SubscriptionStatus> = {
        ACTIVE: 'ACTIVE', GRACE: 'GRACE', EXPIRED: 'EXPIRED',
        CANCELLED: 'CANCELLED', FREE: 'FREE',
      };
      const status: SubscriptionStatus = statusMap[statusUpper] ?? 'FREE';

      const expiresAt: string | null      = (res as any).nextBillingDate ?? (res as any).expiresAt ?? payload.expiresAt ?? payload.currentPeriodEnd ?? null;
      const gracePeriodEnd: string | null = (res as any).gracePeriodEnd ?? payload.gracePeriodEnd ?? null;
      // Backend sends trialEndsAt at top level
      const trialExpiresAt: string | null = (res as any).trialEndsAt ?? (res as any).trialExpiresAt ?? payload.trialExpiresAt ?? payload.trialEndDate ?? null;
      const rawInterval                   = (res as any).interval ?? payload.interval ?? null;
      const interval: 'MONTHLY' | 'YEARLY' | null =
        rawInterval?.toUpperCase() === 'YEARLY'  ? 'YEARLY'  :
        rawInterval?.toUpperCase() === 'MONTHLY' ? 'MONTHLY' : null;

      // ACTIVE
      if (statusUpper === 'ACTIVE' || statusUpper === 'PAID' || statusUpper === 'SUBSCRIBED') {
        localStorage.setItem(STORAGE_TIER, tier);
        if (expiresAt) localStorage.setItem(STORAGE_EXPIRY, expiresAt);
        else localStorage.removeItem(STORAGE_EXPIRY);
        setState({ tier, status: 'ACTIVE', planName: planLabel, expiresAt, gracePeriodEnd: null, trialExpiresAt: null, interval, isLoaded: true });
        return;
      }

      // GRACE — features still available, billing failed
      if (statusUpper === 'GRACE') {
        localStorage.setItem(STORAGE_TIER, tier);
        if (expiresAt) localStorage.setItem(STORAGE_EXPIRY, expiresAt);
        setState({ tier, status: 'GRACE', planName: planLabel, expiresAt, gracePeriodEnd, trialExpiresAt: null, interval, isLoaded: true });
        return;
      }

      // CANCELLED — still active until billing date
      if (statusUpper === 'CANCELLED') {
        const cancelledStillActive = tier !== 'FREE' && expiresAt !== null && new Date(expiresAt) > new Date();
        if (cancelledStillActive) {
          localStorage.setItem(STORAGE_TIER, tier);
          if (expiresAt) localStorage.setItem(STORAGE_EXPIRY, expiresAt);
          setState({ tier, status: 'CANCELLED', planName: planLabel, expiresAt, gracePeriodEnd: null, trialExpiresAt: null, interval, isLoaded: true });
          return;
        }
        localStorage.setItem(STORAGE_TIER, 'FREE');
        localStorage.removeItem(STORAGE_EXPIRY);
        setState({ tier: 'FREE', status: 'CANCELLED', planName: 'Free Trial', expiresAt: null, gracePeriodEnd: null, trialExpiresAt, interval: null, isLoaded: true });
        return;
      }

      // EXPIRED
      if (statusUpper === 'EXPIRED') {
        localStorage.setItem(STORAGE_TIER, 'FREE');
        localStorage.removeItem(STORAGE_EXPIRY);
        setState({ tier: 'FREE', status: 'EXPIRED', planName: 'Free Trial', expiresAt: null, gracePeriodEnd: null, trialExpiresAt, interval: null, isLoaded: true });
        return;
      }

      // FREE / TRIAL — or backend says FREE but tier field says paid (trust tier)
      if (tier !== 'FREE') {
        localStorage.setItem(STORAGE_TIER, tier);
        if (expiresAt) localStorage.setItem(STORAGE_EXPIRY, expiresAt);
        setState({ tier, status: 'ACTIVE', planName: planLabel, expiresAt, gracePeriodEnd: null, trialExpiresAt: null, interval, isLoaded: true });
        return;
      }
      localStorage.setItem(STORAGE_TIER, 'FREE');
      localStorage.removeItem(STORAGE_EXPIRY);
      setState({ tier: 'FREE', status: 'FREE', planName: 'Free Trial', expiresAt: null, gracePeriodEnd: null, trialExpiresAt, interval: null, isLoaded: true });
    } catch {
      // Network failure — restore from cache
      try {
        const cachedTier   = localStorage.getItem(STORAGE_TIER) as PlanTier | null;
        const cachedExpiry = localStorage.getItem(STORAGE_EXPIRY);
        if (cachedTier && cachedTier !== 'FREE' && cachedExpiry && new Date(cachedExpiry) > new Date()) {
          setState(prev => ({ ...prev, tier: cachedTier, status: 'ACTIVE', expiresAt: cachedExpiry, isLoaded: true }));
        } else {
          setState(prev => ({ ...prev, isLoaded: true }));
        }
      } catch { setState(prev => ({ ...prev, isLoaded: true })); }
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-check when tab becomes visible (mirrors mobile foreground refresh)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const resetToFree = useCallback(() => {
    localStorage.removeItem(STORAGE_TIER);
    localStorage.removeItem(STORAGE_EXPIRY);
    setState({ tier: 'FREE', status: 'FREE', planName: 'Free Trial', expiresAt: null, gracePeriodEnd: null, trialExpiresAt: null, interval: null, isLoaded: true });
  }, []);

  const can = useCallback((feature: FeatureKey): boolean => {
    // FREE tier — check trial (matches mobile exactly)
    if (state.tier === 'FREE') {
      const trialExpired = state.trialExpiresAt !== null && new Date() > new Date(state.trialExpiresAt);
      if (!trialExpired) return true;  // active trial: all features unlocked
      return false;                    // trial over: nothing accessible
    }
    // GRACE — features still available based on tier (same as mobile)
    // CANCELLED within billing period — same
    // EXPIRED — tier is already set to FREE by refresh() above, so won't reach here
    const allowed = FEATURE_GATES[feature] ?? [];
    return allowed.includes(state.tier);
  }, [state.tier, state.trialExpiresAt]);

  // Trial logic
  const now = Date.now();
  const trialMs     = state.trialExpiresAt ? new Date(state.trialExpiresAt).getTime() : null;
  const isTrialExpired  = state.tier === 'FREE' && trialMs !== null && trialMs < now;
  const trialDaysLeft   = state.tier === 'FREE' && trialMs !== null && trialMs >= now
    ? Math.ceil((trialMs - now) / (1000 * 60 * 60 * 24)) : null;
  const isTransactionBlocked = isTrialExpired; // matches mobile — only trial expiry hard-blocks transactions

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh, resetToFree, can, isTrialExpired, trialDaysLeft, isTransactionBlocked }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

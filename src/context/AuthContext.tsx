'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import * as api from '@/services/apiService';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_USER'; payload: User };

interface AuthContextType extends AuthState {
  signIn: (identifier: string, password: string) => Promise<boolean>;
  sendOTP: (email: string, phone: string) => Promise<boolean>;
  verifyOTP: (email: string, phone: string, otp: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setUser: (user: User) => void;
  checkStatus: (identifier: string) => Promise<any>;
}

const initialState: AuthState = { isLoading: true, isAuthenticated: false, user: null, error: null };

const reducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START': return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS': return { isLoading: false, isAuthenticated: true, user: action.payload, error: null };
    case 'AUTH_FAILURE': return { ...state, isLoading: false, isAuthenticated: false, user: null, error: action.payload };
    case 'LOGOUT': return { isLoading: false, isAuthenticated: false, user: null, error: null };
    case 'CLEAR_ERROR': return { ...state, error: null };
    case 'SET_USER': return { ...state, isLoading: false, isAuthenticated: true, user: action.payload };
    default: return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      if (!api.isAuthenticated()) {
        dispatch({ type: 'LOGOUT' });
        return;
      }
      try {
        const cached = localStorage.getItem('cachedUser');
        if (cached) {
          dispatch({ type: 'AUTH_SUCCESS', payload: JSON.parse(cached) });
        }
        const res = await api.getCurrentUser();
        if (res.success && res.user) {
          // Also fetch business profile to get the most up-to-date business name
          let user = res.user;
          try {
            const bpRes = await api.getBusinessProfile();
            const d = (bpRes?.data as any);
            const bizName =
              d?.business?.name ||
              d?.business?.businessName ||
              d?.businessName ||
              d?.name ||
              d?.business_name ||
              d?.profile?.businessName ||
              d?.profile?.name ||
              d?.businessProfile?.name ||
              d?.businessProfile?.businessName;
            if (bizName) user = { ...user, businessName: bizName };
          } catch {}
          localStorage.setItem('cachedUser', JSON.stringify(user));
          dispatch({ type: 'AUTH_SUCCESS', payload: user });
        } else {
          api.logout();
          dispatch({ type: 'LOGOUT' });
        }
      } catch {
        dispatch({ type: 'LOGOUT' });
      }
    };
    init();
  }, []);

  const signIn = async (identifier: string, password: string): Promise<boolean> => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await api.signIn(identifier, password);
      if (res.success && res.user && res.token) {
        localStorage.setItem('cachedUser', JSON.stringify(res.user));
        dispatch({ type: 'AUTH_SUCCESS', payload: res.user });
        return true;
      }
      dispatch({ type: 'AUTH_FAILURE', payload: res.message || 'Invalid credentials' });
      return false;
    } catch {
      dispatch({ type: 'AUTH_FAILURE', payload: 'Sign in failed' });
      return false;
    }
  };

  const sendOTP = async (email: string, phone: string): Promise<boolean> => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await api.sendOTP(email, phone);
      if (res.success) { dispatch({ type: 'CLEAR_ERROR' }); return true; }
      dispatch({ type: 'AUTH_FAILURE', payload: res.message || 'Failed to send OTP' });
      return false;
    } catch {
      dispatch({ type: 'AUTH_FAILURE', payload: 'Network error' });
      return false;
    }
  };

  const verifyOTP = async (email: string, phone: string, otp: string): Promise<boolean> => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await api.verifyOTP(email, phone, otp);
      if (res.success && res.user && res.token) {
        localStorage.setItem('cachedUser', JSON.stringify(res.user));
        dispatch({ type: 'AUTH_SUCCESS', payload: res.user });
        return true;
      }
      dispatch({ type: 'AUTH_FAILURE', payload: res.message || 'Invalid OTP' });
      return false;
    } catch {
      dispatch({ type: 'AUTH_FAILURE', payload: 'Verification failed' });
      return false;
    }
  };

  const checkStatus = async (identifier: string) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await api.checkUserStatus(identifier);
      if (res.success) {
        if (res.userStatus === 'verified_no_password' && res.token && res.user) {
          localStorage.setItem('cachedUser', JSON.stringify(res.user));
          dispatch({ type: 'AUTH_SUCCESS', payload: res.user });
        } else {
          dispatch({ type: 'AUTH_FAILURE', payload: '' });
        }
        return res;
      }
      throw new Error(res.message);
    } catch (e: any) {
      dispatch({ type: 'AUTH_FAILURE', payload: e.message || 'Check failed' });
      throw e;
    }
  };

  const logout = () => {
    api.logout();
    localStorage.removeItem('cachedUser');
    localStorage.removeItem('subscriptionTier');
    localStorage.removeItem('subscriptionExpiresAt');
    dispatch({ type: 'LOGOUT' });
    router.replace('/login');
  };

  const setUser = (user: User) => {
    localStorage.setItem('cachedUser', JSON.stringify(user));
    dispatch({ type: 'SET_USER', payload: user });
  };

  const clearError = () => dispatch({ type: 'CLEAR_ERROR' });

  return (
    <AuthContext.Provider value={{ ...state, signIn, sendOTP, verifyOTP, logout, clearError, setUser, checkStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

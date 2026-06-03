'use client';
import { useQuery } from '@tanstack/react-query';
import { getDashboardHome, getSales, getExpenses, getBalanceSettings, getBusinessProfile } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';

export default function DebugPage() {
  const { user } = useAuth();
  const { data: home } = useQuery({ queryKey: ['dbg-home'], queryFn: getDashboardHome });
  const { data: bal  } = useQuery({ queryKey: ['dbg-bal'],  queryFn: getBalanceSettings });
  const { data: bp   } = useQuery({ queryKey: ['dbg-bp'],   queryFn: getBusinessProfile });
  const { data: sales} = useQuery({ queryKey: ['dbg-sales'],queryFn: () => getSales({ limit: 3 }) });
  const { data: exp  } = useQuery({ queryKey: ['dbg-exp'],  queryFn: () => getExpenses({ limit: 3 }) });

  const box = (label: string, data: any) => (
    <div className="mb-4">
      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{label}</p>
      <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-2 p-4">
      <h1 className="text-base font-bold mb-4">API Debug — share this with your developer</h1>
      {box('user context (from /auth/me + localStorage)', user)}
      {box('/dashboard/home', home)}
      {box('/business/settings/balance', bal)}
      {box('/business/profile/enhanced', bp)}
      {box('/sales (first 3)', sales)}
      {box('/expenses (first 3)', exp)}
    </div>
  );
}

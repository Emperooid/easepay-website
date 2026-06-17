'use client';

import { Lock } from 'lucide-react';

export function AccessRestricted({ message = "You don't have permission to access this page." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Lock size={26} className="text-gray-400" />
      </div>
      <h2 className="text-base font-bold text-gray-900 mb-1.5">Access Restricted</h2>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">{message}</p>
    </div>
  );
}

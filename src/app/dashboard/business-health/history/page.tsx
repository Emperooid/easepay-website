'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

const SCORE_LABELS: Record<number, string> = {};
function scoreLabel(s: number) {
  return s >= 80 ? 'Excellent' : s >= 60 ? 'Strong' : s >= 40 ? 'Fair' : 'Weak';
}
function scoreColor(s: number) {
  return s >= 80 ? 'text-green-600' : s >= 60 ? 'text-blue-600' : s >= 40 ? 'text-yellow-600' : 'text-red-500';
}
function scoreBg(s: number) {
  return s >= 80 ? 'bg-green-50 border-green-200' : s >= 60 ? 'bg-blue-50 border-blue-200' : s >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
}

const METRIC_LABELS = [
  { key: 'revenueConsistency', label: 'Revenue Consistency', max: 30, color: '#22c55e' },
  { key: 'paymentHistory',     label: 'Payment History',     max: 30, color: '#3b82f6' },
  { key: 'businessAge',        label: 'Business Age',        max: 20, color: '#a855f7' },
  { key: 'profileCompleteness',label: 'Profile Completeness',max: 20, color: '#f59e0b' },
];

export default function BusinessHealthHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bh_score_history');
      const entries = raw ? JSON.parse(raw) : [];
      setHistory([...entries].reverse()); // newest first
    } catch {
      setHistory([]);
    }
  }, []);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/business-health"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Health Score History</h1>
          <p className="text-sm text-gray-400 mt-0.5">Your business health score snapshots over time.</p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BarChart3 size={36} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium text-gray-500 text-sm">No history yet</p>
          <p className="text-xs mt-1.5 max-w-xs mx-auto">
            Visit your Business Health page to generate your first snapshot — it's saved automatically.
          </p>
          <Link href="/dashboard/business-health"
            className="inline-block mt-4 px-4 py-2 bg-[#050A30] text-white text-sm font-semibold rounded-xl hover:bg-[#0a1460] transition-colors">
            Go to Business Health
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry, idx) => {
            const prevScore = idx < history.length - 1 ? history[idx + 1].score : null;
            const delta = prevScore !== null ? Math.round(entry.score - prevScore) : null;
            return (
              <div key={entry.date} className={`bg-white rounded-xl border p-4 space-y-3 ${idx === 0 ? 'border-[#050A30]/20 ring-1 ring-[#050A30]/10' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {idx === 0 && <span className="text-[10px] text-[#050A30] font-semibold bg-[#050A30]/10 px-1.5 py-0.5 rounded-full">Latest</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {delta !== null && delta !== 0 && (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                    <span className={`text-xl font-bold ${scoreColor(entry.score)}`}>{Math.round(entry.score)}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreBg(entry.score)} ${scoreColor(entry.score)}`}>
                      {scoreLabel(entry.score)}
                    </span>
                  </div>
                </div>

                {entry.metrics && (
                  <div className="space-y-1.5">
                    {METRIC_LABELS.map(m => {
                      const pct = entry.metrics[m.key] || 0;
                      const pts = Math.round((pct / 100) * m.max);
                      return (
                        <div key={m.key} className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-500 w-32 flex-shrink-0">{m.label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: m.color }} />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-600 w-10 text-right">{pts}/{m.max}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

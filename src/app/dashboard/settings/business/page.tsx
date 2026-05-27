'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getBusinessProfile, updateBusinessProfile } from '@/services/apiService';
import { Loader2, CheckCircle } from 'lucide-react';

export default function BusinessProfilePage() {
  const [form, setForm] = useState({ businessName: '', address: '', taxId: '', bn: '', rc: '', phoneNumber: '' });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['business'], queryFn: getBusinessProfile });
  const updateMut = useMutation({
    mutationFn: updateBusinessProfile,
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  useEffect(() => {
    const b = (data?.data as any) || data;
    if (b) setForm({ businessName: b.businessName || b.name || '', address: b.address || b.businessAddress || '', taxId: b.taxId || '', bn: b.bn || '', rc: b.rc || '', phoneNumber: b.phoneNumber || b.phone || '' });
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate(form);
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Business Information</h3>
        {saved && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle size={16} /> Changes saved successfully
          </div>
        )}
        {updateMut.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">Failed to save changes</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input type="text" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="tel" value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
              <input type="text" value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BN</label>
              <input type="text" value={form.bn} onChange={e => setForm(f => ({ ...f, bn: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RC</label>
              <input type="text" value={form.rc} onChange={e => setForm(f => ({ ...f, rc: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
            </div>
          </div>
          <button type="submit" disabled={updateMut.isPending} className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
            {updateMut.isPending && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}

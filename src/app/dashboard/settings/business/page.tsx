'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getBusinessProfile, updateBusinessProfile, getCurrentUser, uploadImage } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { Loader2, CheckCircle, ChevronLeft, Upload, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function BusinessProfilePage() {
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    businessName: '', address: '', taxId: '', bn: '', rc: '', phoneNumber: '', logo: '',
  });
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['business'], queryFn: getBusinessProfile });

  const updateMut = useMutation({
    mutationFn: updateBusinessProfile,
    onSuccess: async () => {
      toast.success('Business profile saved!');
      // Refresh user context so business name updates everywhere
      try {
        const res = await getCurrentUser();
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch {}
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  useEffect(() => {
    const b = (data?.data as any) || data;
    if (b && typeof b === 'object') {
      setForm({
        businessName: b.businessName || b.name || '',
        address: b.address || b.businessAddress || '',
        taxId: b.taxId || '',
        bn: b.bn || '',
        rc: b.rc || '',
        phoneNumber: b.phoneNumber || b.phone || '',
        logo: b.logo || b.logoUrl || '',
      });
    }
  }, [data]);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Upload an image file'); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(f => ({ ...f, logo: url }));
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate(form);
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={24} /></div>;

  return (
    <div className="max-w-xl space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Business Profile</h1>
          <p className="text-xs text-gray-400">Update your business information</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {/* Logo */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">Business Logo</label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
          <div className="flex items-center gap-3">
            {form.logo ? (
              <div className="relative">
                <img src={form.logo} alt="Logo" className="h-14 w-14 rounded-xl border border-gray-200 object-contain bg-white p-1" />
                <button onClick={() => setForm(f => ({ ...f, logo: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm">
                  <X size={10} />
                </button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-300">
                {uploading ? <Loader2 size={16} className="animate-spin text-[#050A30]" /> : <Upload size={16} />}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              {uploading ? 'Uploading...' : form.logo ? 'Change Logo' : 'Upload Logo'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Business Name</label>
            <input type="text" value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number</label>
            <input type="tel" value={form.phoneNumber} onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Address</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['Tax ID', 'taxId'], ['BN Number', 'bn'], ['RC Number', 'rc']].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
                <input type="text" value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
            ))}
          </div>
          <button type="submit" disabled={updateMut.isPending}
            className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
            {updateMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

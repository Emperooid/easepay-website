'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBusinessProfile, updateBusinessProfile, getCurrentUser } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ChevronLeft, Upload, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

function extractProfile(data: any) {
  // Try every nesting shape the backend might return
  const raw = data?.data || data;
  return (raw as any)?.profile
    || (raw as any)?.business
    || (raw as any)?.businessProfile
    || (raw as any)?.data
    || raw
    || {};
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // data:image/...;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BusinessProfilePage() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    businessName: '', address: '', taxId: '', bn: '', rc: '', phoneNumber: '', logo: '',
  });
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['business'], queryFn: getBusinessProfile });

  const updateMut = useMutation({
    mutationFn: updateBusinessProfile,
    onSuccess: async (res) => {
      // Extract the returned logoUrl if backend processed it via Cloudinary
      const b = extractProfile(res);
      const cloudinaryUrl = b.logoUrl || b.logo || b.logoURL;
      if (cloudinaryUrl && cloudinaryUrl.startsWith('http')) {
        setForm(f => ({ ...f, logo: cloudinaryUrl }));
      }
      qc.invalidateQueries({ queryKey: ['business'] });
      toast.success('Business profile saved!');
      try {
        const res2 = await getCurrentUser();
        if (res2.success && res2.user) setUser(res2.user);
      } catch {}
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  useEffect(() => {
    if (!data) return;
    const b = extractProfile(data);
    if (b && typeof b === 'object' && !Array.isArray(b)) {
      setForm({
        businessName: b.businessName || b.name || '',
        address: b.address || b.businessAddress || '',
        taxId: b.taxId || b.tax_id || b.tinNumber || '',
        bn: b.bn || b.bnNumber || b.businessNumber || '',
        rc: b.rc || b.rcNumber || b.rc_number || '',
        phoneNumber: b.phoneNumber || b.phone || '',
        logo: b.logoUrl || b.logo || b.logoURL || '',
      });
    }
  }, [data]);

  // Same approach as mobile: convert to base64 and include in profile update payload
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const base64DataUri = await fileToBase64(file);
      // Show preview immediately
      setForm(f => ({ ...f, logo: base64DataUri }));
      // Save to backend immediately (mobile does the same)
      const res = await updateBusinessProfile({ logo: base64DataUri });
      const b = extractProfile(res);
      const cloudinaryUrl = b.logoUrl || b.logo || b.logoURL;
      if (cloudinaryUrl && cloudinaryUrl.startsWith('http')) {
        setForm(f => ({ ...f, logo: cloudinaryUrl }));
      }
      qc.invalidateQueries({ queryKey: ['business'] });
      toast.success('Logo updated!');
    } catch (e: any) {
      toast.error(e.message || 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Don't resend base64 in the regular save — only send the URL or omit logo if it's base64
    const payload: any = { ...form };
    if (payload.logo?.startsWith('data:')) delete payload.logo; // already uploaded
    updateMut.mutate(payload);
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

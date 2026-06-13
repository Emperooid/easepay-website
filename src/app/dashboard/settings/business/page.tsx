'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBusinessProfile, updateBusinessProfile, getCurrentUser } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import {
  Loader2, ChevronLeft, ChevronRight, Camera,
  Mail, Building2, Phone, MapPin, FileText, BookOpen, ShieldCheck, Trash2, X,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// ── Same field-name mapping as mobile handleSaveEdit ─────────────────────────
function buildPayload(field: string, value: string): Record<string, string> {
  switch (field) {
    case 'businessName':
      return { name: value, businessName: value };
    case 'phoneNumber':
      return { phone: value, phoneNumber: value };
    case 'address':
      return { address: value, businessAddress: value };
    case 'taxId':
      return { taxId: value, tax_id: value, tinNumber: value, vatRegistration: value };
    case 'bn':
      return { bn: value, bnNumber: value, bn_number: value };
    case 'rc':
      return { rc: value, rcNumber: value, rc_number: value };
    default:
      return { [field]: value };
  }
}

// ── Same data extraction as mobile ────────────────────────────────────────────
function extractBusinessInfo(data: any, user: any) {
  // The API response is { success: true, data: { business: {...}, email: "...", ... } }
  // Mobile accesses: response.data => directly the whole data object
  const raw = data?.data || data;
  const b   = raw?.business || raw?.businessProfile || raw?.profile || raw || {};

  const rawAddress = b.address || b.businessAddress || raw.address || raw.businessAddress || '';
  const safeAddress = rawAddress.includes('@') ? '' : rawAddress;

  return {
    businessName: b.name || b.businessName || raw.businessName || raw.name || user?.businessName || '',
    email:        raw.email || raw.registrationName || b.email || user?.email || '',
    logo:         raw.logoUrl || b.logoUrl || b.logo || raw.logo || user?.avatar || '',
    phoneNumber:  raw.phone || raw.phoneNumber || b.phone || b.phoneNumber || user?.phone || '',
    address:      safeAddress,
    taxId:        b.tinNumber || b.taxId || b.tax_id || raw.taxId || raw.tinNumber || b.vatRegistration || '',
    bn:           b.bnNumber || b.bn || raw.bnNumber || raw.bn || b.bn_number || '',
    rc:           b.rcNumber || b.rc || raw.rcNumber || raw.rc || b.rc_number || '',
    joinDate:     raw.createdAt || b.createdAt || raw.registrationDate || '',
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FIELD_META: { key: string; label: string; icon: any; multiline?: boolean }[] = [
  { key: 'email',        label: 'Email Address',  icon: Mail },
  { key: 'businessName', label: 'Business Name',  icon: Building2 },
  { key: 'phoneNumber',  label: 'Phone Number',   icon: Phone },
  { key: 'address',      label: 'Address',        icon: MapPin, multiline: true },
  { key: 'taxId',        label: 'Tax ID',         icon: FileText },
  { key: 'bn',           label: 'BN Number',      icon: BookOpen },
  { key: 'rc',           label: 'RC Number',      icon: ShieldCheck },
];

export default function BusinessProfilePage() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [details, setDetails] = useState({
    businessName: '', email: '', logo: '', phoneNumber: '',
    address: '', taxId: '', bn: '', rc: '', joinDate: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Edit modal state
  const [editField,  setEditField]  = useState<string | null>(null);
  const [editValue,  setEditValue]  = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // ── Load from API (same as mobile useFocusEffect) ─────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['business-profile'],
    queryFn:  getBusinessProfile,
  });

  useEffect(() => {
    if (!data) return;
    const info = extractBusinessInfo(data, user);
    setDetails(info);
  }, [data, user]);

  // ── Logo upload (exact same as mobile pickImage) ──────────────────────────
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploading(true);
    try {
      const base64DataUri = await fileToBase64(file);
      // Optimistic preview
      setDetails(d => ({ ...d, logo: base64DataUri }));

      // Send as { logo: base64DataUri } — same as mobile
      const response = await updateBusinessProfile({ logo: base64DataUri });
      if (!response.success && response.message) {
        throw new Error(response.message);
      }
      // Backend returns Cloudinary URL — same extraction as mobile
      const cloudinaryUrl =
        (response?.data as any)?.data?.logoUrl ||
        (response?.data as any)?.logoUrl       ||
        (response?.data as any)?.logo          ||
        (response as any)?.logoUrl             ||
        base64DataUri;
      setDetails(d => ({ ...d, logo: cloudinaryUrl }));
      qc.invalidateQueries({ queryKey: ['business-profile'] });
      toast.success('Logo updated successfully!');
    } catch (e: any) {
      toast.error(e.message || 'Logo upload failed');
      // Revert preview on error
      setDetails(d => ({ ...d, logo: details.logo }));
    } finally {
      setUploading(false);
    }
  };

  // ── Save individual field (exact same as mobile handleSaveEdit) ───────────
  const handleSaveField = async () => {
    if (!editField) return;
    setEditLoading(true);
    try {
      const payload = buildPayload(editField, editValue);
      const response = await updateBusinessProfile(payload);
      if (!response.success && response.message) {
        throw new Error(response.message || 'Failed to save');
      }
      setDetails(d => ({ ...d, [editField]: editValue }));
      // Refresh user context if business name changed
      if (editField === 'businessName') {
        try {
          const res = await getCurrentUser();
          if (res.success && res.user) setUser(res.user);
        } catch {}
      }
      qc.invalidateQueries({ queryKey: ['business-profile'] });
      setEditField(null);
      toast.success('Saved!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setEditLoading(false);
    }
  };

  const openEdit = (field: string) => {
    setEditField(field);
    setEditValue((details as any)[field] || '');
  };

  const getInitials = (name: string) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  const joinLabel = details.joinDate
    ? `Joined ${new Date(details.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}`
    : '';

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="animate-spin text-gray-300" size={24} />
    </div>
  );

  return (
    <div className="max-w-xl animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/settings" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Business Details</h1>
          <p className="text-xs text-gray-400">Update your business information</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── Avatar / Logo ── */}
        <div className="flex flex-col items-center py-8 border-b border-gray-50">
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="relative w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden mb-2 hover:opacity-90 transition-opacity">
            {details.logo ? (
              <img src={details.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-gray-500">{getInitials(details.businessName)}</span>
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center border-2 border-white">
              {uploading
                ? <Loader2 size={11} className="animate-spin text-white" />
                : <Camera size={11} className="text-white" />
              }
            </div>
          </button>

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="text-sm text-blue-500 font-medium hover:text-blue-700 transition-colors">
            {uploading ? 'Uploading…' : 'Upload Logo for Invoices'}
          </button>

          {details.businessName && (
            <p className="mt-3 text-lg font-semibold text-gray-900">{details.businessName}</p>
          )}
          {joinLabel && (
            <p className="text-sm text-gray-400">{joinLabel}</p>
          )}
        </div>

        {/* ── Field List (click-to-edit like mobile) ── */}
        <div className="divide-y divide-gray-50">
          {FIELD_META.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => openEdit(key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                <Icon size={20} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {(details as any)[key] || <span className="text-gray-300 font-normal">Not provided</span>}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0 ml-3" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Edit Modal (slides up from bottom like mobile) ── */}
      {editField && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditField(null)} />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-3xl w-full max-w-xl p-6 pb-10 animate-in slide-in-from-bottom-4 duration-200">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-900">
                Change {FIELD_META.find(f => f.key === editField)?.label}
              </h2>
              <button onClick={() => setEditField(null)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                {FIELD_META.find(f => f.key === editField)?.label}
              </label>
              {FIELD_META.find(f => f.key === editField)?.multiline ? (
                <textarea
                  autoFocus rows={3}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  placeholder={`Enter ${FIELD_META.find(f => f.key === editField)?.label?.toLowerCase()}`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none"
                />
              ) : (
                <input
                  autoFocus
                  type={editField === 'email' ? 'email' : editField === 'phoneNumber' ? 'tel' : 'text'}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveField(); }}
                  placeholder={`Enter ${FIELD_META.find(f => f.key === editField)?.label?.toLowerCase()}`}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30]"
                />
              )}
            </div>

            <button onClick={handleSaveField} disabled={editLoading}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {editLoading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

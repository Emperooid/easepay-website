'use client';

import { useState, useEffect, useRef } from 'react';
import { updateBusinessProfile } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, Loader2, Upload, X, Palette, FileText, PenLine, Check } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Same key pattern as mobile: `invoiceTemplateSettings_${userId}`
function getSettingsKey(user: any) {
  const uid = user?.id || user?.userId || user?.email || 'default';
  return `invoiceTemplateSettings_${uid}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const TEMPLATES = [
  { id: 'classic', name: 'Classic', desc: 'Simple, professional layout' },
  { id: 'modern',  name: 'Modern',  desc: 'Clean design with colored accents' },
  { id: 'minimal', name: 'Minimal', desc: 'Focused on readability' },
];

const ACCENT_COLORS = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#6366F1', '#EC4899', '#111827'];

const DEFAULT_SETTINGS = {
  selectedTemplate: 'classic',
  logoUri:          '',
  accentColor:      '#3B82F6',
  showTax:          true,
  showDiscount:     true,
  footerText:       'Thank you for your business!',
  termsAndConditions: 'Payment is due within 30 days.',
  accountDetails:   '',
  signatureUri:     '',
};

export default function InvoiceTemplatePage() {
  const { user } = useAuth();
  const logoRef      = useRef<HTMLInputElement>(null);
  const signatureRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving,       setSaving]       = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig,  setUploadingSig]  = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load — same as mobile loadSettings() ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const key = getSettingsKey(user);

    (async () => {
      // Store currentInvoiceUserId so PDF generation can look it up
      localStorage.setItem('currentInvoiceUserId', user?.id || user?.email || 'default');
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
        }
      } catch {}
      setIsLoading(false);
    })();
  }, [user]);

  const set = (partial: Partial<typeof DEFAULT_SETTINGS>) =>
    setSettings(s => ({ ...s, ...partial }));

  // ── Logo upload — base64 stored in localStorage (no /api/upload) ─────────
  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    setUploadingLogo(true);
    try {
      const base64 = await fileToBase64(file);
      set({ logoUri: base64 });
      toast.success('Logo ready — save to apply');
    } catch { toast.error('Failed to load image'); }
    finally { setUploadingLogo(false); }
  };

  // ── Signature upload ──────────────────────────────────────────────────────
  const handleSignatureUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setUploadingSig(true);
    try {
      const base64 = await fileToBase64(file);
      // Try to upload to backend via profile update (same as mobile)
      try {
        const res = await updateBusinessProfile({ signatureUrl: base64 });
        const url = (res?.data as any)?.signatureUrl || (res?.data as any)?.data?.signatureUrl;
        set({ signatureUri: url || base64 });
      } catch {
        set({ signatureUri: base64 });
      }
      toast.success('Signature ready — save to apply');
    } catch { toast.error('Failed to load signature'); }
    finally { setUploadingSig(false); }
  };

  // ── Save — same as mobile saveSettings() — localStorage primary ──────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const key = getSettingsKey(user);
      localStorage.setItem(key, JSON.stringify(settings));
      // Sync signature URL to backend profile if it's a remote URL
      if (settings.signatureUri?.startsWith('http')) {
        await updateBusinessProfile({ signatureUrl: settings.signatureUri }).catch(() => {});
      }
      toast.success('Invoice template saved!');
    } catch {
      toast.error('Failed to save template settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="animate-spin text-gray-300" size={28} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Invoice Template</h1>
          <p className="text-xs text-gray-400">Customise how your invoices look</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Left column: settings ── */}
        <div className="space-y-4">

          {/* Logo */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText size={14} /> Business Logo
            </h3>
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
            <div className="flex items-center gap-3">
              {settings.logoUri ? (
                <div className="relative">
                  <img src={settings.logoUri} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50 p-1" />
                  <button onClick={() => set({ logoUri: '' })}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X size={9} />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                  {uploadingLogo ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <Upload size={16} className="text-gray-300" />}
                </div>
              )}
              <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                {uploadingLogo ? 'Loading…' : settings.logoUri ? 'Change Logo' : 'Upload Logo'}
              </button>
            </div>
          </div>

          {/* Template */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Template Style</h3>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => set({ selectedTemplate: t.id })}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${settings.selectedTemplate === t.id ? 'border-[#050A30] bg-[#050A30]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-bold ${settings.selectedTemplate === t.id ? 'text-[#050A30]' : 'text-gray-900'}`}>{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                    </div>
                    {settings.selectedTemplate === t.id && <Check size={16} className="text-[#050A30] flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><Palette size={14} /> Accent Color</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {ACCENT_COLORS.map(color => (
                <button key={color} onClick={() => set({ accentColor: color })}
                  className={`w-9 h-9 rounded-xl border-4 transition-all ${settings.accentColor === color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Custom:</label>
              <input type="color" value={settings.accentColor}
                onChange={e => set({ accentColor: e.target.value })}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
              <span className="text-xs font-mono text-gray-500">{settings.accentColor}</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {[
              { key: 'showTax',      label: 'Show VAT/Tax',   desc: 'Display VAT amounts on invoice' },
              { key: 'showDiscount', label: 'Show Discount',  desc: 'Display discount line on invoice' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <button onClick={() => set({ [key]: !(settings as any)[key] } as any)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${(settings as any)[key] ? 'bg-blue-500' : 'bg-gray-200'}`}>
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${(settings as any)[key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right column: text fields + signature ── */}
        <div className="space-y-4">

          {/* Footer text */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-sm font-bold text-gray-900 mb-2">Footer Text</label>
            <textarea value={settings.footerText}
              onChange={e => set({ footerText: e.target.value })}
              rows={2} placeholder="Thank you for your business!"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
          </div>

          {/* Terms */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-sm font-bold text-gray-900 mb-2">Terms & Conditions</label>
            <textarea value={settings.termsAndConditions}
              onChange={e => set({ termsAndConditions: e.target.value })}
              rows={3} placeholder="Payment is due within 30 days."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
          </div>

          {/* Bank / Account Details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <label className="block text-sm font-bold text-gray-900 mb-2">Bank / Account Details</label>
            <textarea value={settings.accountDetails}
              onChange={e => set({ accountDetails: e.target.value })}
              rows={3} placeholder="Bank: GTBank&#10;Account: 0123456789&#10;Name: My Business Ltd"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
          </div>

          {/* Signature */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <PenLine size={14} /> Signature
            </h3>
            <input ref={signatureRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSignatureUpload(f); e.target.value = ''; }} />
            {settings.signatureUri ? (
              <div className="relative inline-block mb-3">
                <img src={settings.signatureUri} alt="Signature"
                  className="h-16 max-w-full border border-gray-200 rounded-xl object-contain bg-gray-50 p-1" />
                <button onClick={() => set({ signatureUri: '' })}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <X size={9} />
                </button>
              </div>
            ) : (
              <div className="w-full h-16 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
                {uploadingSig ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <span className="text-xs text-gray-300">No signature</span>}
              </div>
            )}
            <button onClick={() => signatureRef.current?.click()} disabled={uploadingSig}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <Upload size={12} /> {uploadingSig ? 'Loading…' : settings.signatureUri ? 'Change Signature' : 'Upload Signature'}
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-4 bg-[#050A30] text-white rounded-2xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
        {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : 'Save Template Settings'}
      </button>
    </div>
  );
}

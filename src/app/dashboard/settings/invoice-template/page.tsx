'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSettings, updateSettings, uploadImage } from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft, Loader2, CheckCircle2, Upload, X, Palette, FileText } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const TEMPLATES = [
  { id: 'classic', name: 'Classic', preview: 'Simple, professional layout with header and footer' },
  { id: 'modern', name: 'Modern', preview: 'Clean two-column design with colored accents' },
  { id: 'minimal', name: 'Minimal', preview: 'Minimal design focused on readability' },
];

const COLOR_PRESETS = [
  '#050A30', '#1e40af', '#0f766e', '#7c3aed', '#be123c', '#c2410c', '#166534', '#1e3a5f',
];

export default function InvoiceTemplatePage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    templateId: 'classic',
    primaryColor: '#050A30',
    customColor: '',
    showVat: true,
    showDiscount: true,
    logo: '',
    footerText: '',
    termsAndConditions: '',
    bankAccount: '',
    signature: '',
  });
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const saveMut = useMutation({
    mutationFn: (s: any) => updateSettings({ invoiceSettings: s }),
    onSuccess: () => toast.success('Template saved!'),
    onError: () => toast.error('Failed to save'),
  });

  useEffect(() => {
    if (data) {
      const s = ((data?.data || data) as any)?.invoiceSettings;
      if (s) setForm(prev => ({ ...prev, ...s }));
    }
  }, [data]);

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(f => ({ ...f, logo: url }));
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  const activeColor = form.customColor || form.primaryColor;

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>;

  return (
    <div className="max-w-2xl space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Invoice Template</h1>
          <p className="text-xs text-gray-400">Customize how your invoices look</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Settings */}
        <div className="space-y-4">
          {/* Template Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Template Style</h3>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, templateId: t.id }))}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${form.templateId === t.id ? 'border-[#050A30] bg-[#050A30]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-sm font-bold ${form.templateId === t.id ? 'text-[#050A30]' : 'text-gray-900'}`}>{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.preview}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Palette size={14} /> Brand Color</h3>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(color => (
                <button key={color} onClick={() => setForm(f => ({ ...f, primaryColor: color, customColor: '' }))}
                  className={`w-9 h-9 rounded-xl border-4 transition-all ${form.primaryColor === color && !form.customColor ? 'border-[#050A30] scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Custom Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.customColor || form.primaryColor} onChange={e => setForm(f => ({ ...f, customColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
                <input type="text" value={form.customColor || form.primaryColor} onChange={e => setForm(f => ({ ...f, customColor: e.target.value }))} placeholder="#000000"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Business Logo</h3>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
            {form.logo ? (
              <div className="relative inline-block">
                <img src={form.logo} alt="Logo" className="h-20 w-auto rounded-xl border border-gray-200 object-contain bg-white p-2" />
                <button onClick={() => setForm(f => ({ ...f, logo: '' }))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full py-4 border-2 border-dashed border-gray-300 hover:border-[#050A30] rounded-xl flex flex-col items-center gap-2 transition-all hover:bg-gray-50">
                {uploading ? <Loader2 size={20} className="animate-spin text-[#050A30]" /> : <Upload size={20} className="text-gray-400" />}
                <span className="text-xs font-medium text-gray-500">{uploading ? 'Uploading...' : 'Upload Logo'}</span>
              </button>
            )}
          </div>

          {/* Toggles */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Display Options</h3>
            {[
              { key: 'showVat', label: 'Show VAT line', desc: 'Display VAT breakdown on invoice' },
              { key: 'showDiscount', label: 'Show Discount', desc: 'Display discount details' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${(form as any)[key] ? 'bg-[#050A30]' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${(form as any)[key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Invoice Content</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bank Account Details</label>
              <textarea value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} rows={3} placeholder="Bank: Zenith Bank&#10;Account: 0123456789&#10;Name: My Business Ltd"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Terms & Conditions</label>
              <textarea value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} rows={3} placeholder="Payment is due within 30 days of invoice date..."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Footer Text</label>
              <textarea value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} rows={2} placeholder="Thank you for your business!"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30] resize-none" />
            </div>
          </div>

          {/* Mini Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Preview</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <div className="p-4" style={{ borderTop: `4px solid ${activeColor}` }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    {form.logo ? <img src={form.logo} alt="" className="h-10 w-auto object-contain" /> : <div className="w-16 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400" style={{ color: activeColor, fontWeight: 800, fontSize: 11 }}>{user?.businessName?.slice(0, 8) || 'LOGO'}</div>}
                    <p className="font-bold mt-1 text-gray-900" style={{ color: activeColor }}>{user?.businessName || 'Your Business'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900" style={{ color: activeColor }}>INVOICE</p>
                    <p className="text-gray-500">INV-0001</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3 space-y-1">
                  <div className="flex justify-between text-gray-500"><span>Item A × 2</span><span>₦5,000</span></div>
                  {form.showVat && <div className="flex justify-between text-gray-400"><span>VAT (7.5%)</span><span>₦375</span></div>}
                  {form.showDiscount && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₦500</span></div>}
                  <div className="flex justify-between font-bold border-t border-gray-100 pt-1 mt-1" style={{ color: activeColor }}><span>Total</span><span>₦4,875</span></div>
                </div>
                {form.footerText && <p className="text-center text-gray-400 mt-3 italic">{form.footerText}</p>}
              </div>
            </div>
          </div>

          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
            {saveMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

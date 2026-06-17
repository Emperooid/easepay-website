'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeamMembers, getInvitations, getBusinessProfile, getBusinessRoles,
  inviteStaff, removeTeamMember, updateStaffPermissions, resendInvite, revokeInvite,
} from '@/services/apiService';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSubscription } from '@/context/SubscriptionContext';
import Link from 'next/link';
import {
  Loader2, UserPlus, X, Users, Trash2, Search, Key, Mail, Send,
  Copy, Check, MessageCircle, Share2, Lock, Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';

const PERMISSIONS_LIST = [
  { id: 'manage_sales', label: 'Record Sales' },
  { id: 'manage_invoices', label: 'Create Invoices' },
  { id: 'manage_expenses', label: 'Record Expenses' },
  { id: 'manage_stocks', label: 'View & Add Stock' },
  { id: 'view_transactions', label: 'Transaction History' },
  { id: 'view_reports', label: 'Financial Reports' },
  { id: 'view_tax', label: 'Tax Summary' },
  { id: 'export_data', label: 'Export Data' },
  { id: 'import_data', label: 'Import Stock' },
  { id: 'manage_business', label: 'Edit Business Profile' },
  { id: 'change_pin', label: 'Change Own PIN' },
  { id: 'biometric_auth', label: 'Enable Biometrics' },
];

const DEFAULT_INVITE_PERMS = ['manage_sales', 'manage_invoices', 'manage_expenses', 'manage_stocks', 'view_transactions', 'change_pin', 'biometric_auth'];

const FALLBACK_ROLES = [
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Cashier', value: 'CASHIER' },
  { label: 'Sales Rep', value: 'SALES_REP' },
  { label: 'Accountant', value: 'ACCOUNTANT' },
  { label: 'Supervisor', value: 'SUPERVISOR' },
  { label: 'Warehouse Staff', value: 'WAREHOUSE' },
  { label: 'Receptionist', value: 'RECEPTIONIST' },
  { label: 'Technician', value: 'TECHNICIAN' },
  { label: 'Driver', value: 'DRIVER' },
  { label: 'Store Attendant', value: 'STORE_ATTENDANT' },
  { label: 'Customer Service', value: 'CUSTOMER_SERVICE' },
  { label: 'Staff', value: 'STAFF' },
];

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
}

interface PendingInvite {
  id: string;
  email?: string;
  phone?: string;
  role: string;
}

export default function StaffPage() {
  const { user } = useAuth();
  const { isOwner } = usePermissions();
  const { can: canSub } = useSubscription();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'Active' | 'Pending'>('Active');
  const [search, setSearch] = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [rolesList, setRolesList] = useState<any[]>(FALLBACK_ROLES);
  const [inviteForm, setInviteForm] = useState({ email: '', phone: '', name: '', role: 'STAFF' });
  const [invitePerms, setInvitePerms] = useState<string[]>(DEFAULT_INVITE_PERMS);

  const [shareModal, setShareModal] = useState<{ visible: boolean; token: string }>({ visible: false, token: '' });
  const [linkCopied, setLinkCopied] = useState(false);

  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const [resendingId, setResendingId] = useState<string | null>(null);

  const { data: staffData, isLoading: staffLoading } = useQuery({ queryKey: ['staff'], queryFn: getTeamMembers, enabled: isOwner });
  const { data: invitesData, isLoading: invitesLoading } = useQuery({ queryKey: ['invitations'], queryFn: getInvitations, enabled: isOwner });

  useEffect(() => {
    if (!isOwner) return;
    getBusinessRoles().then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const fetched = res.data.map((r: any) => ({
          label: r.name || r.label || r.role || 'Role',
          value: (r.name || r.value || r.role || '').toUpperCase(),
          id: r.id || r._id,
        }));
        setRolesList(fetched);
        setInviteForm(f => (fetched.find((r: any) => r.value === f.role) ? f : { ...f, role: fetched[0].value }));
      }
    }).catch(() => {});
  }, [isOwner]);

  const staff: StaffMember[] = (() => {
    const raw: any = staffData?.data;
    const list: any[] = Array.isArray(raw) ? raw : (raw?.staff || raw?.members || []);
    return list.map((s: any) => ({
      id: s.id || s._id,
      name: s.user
        ? (`${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() || s.user.email || s.user.phone)
        : (s.name || s.email || s.phone || ''),
      email: s.user?.email || s.email || '',
      phone: s.user?.phone || s.phone || '',
      role: s.roleRef?.name || s.role || 'Staff',
      permissions: Array.isArray(s.permissions) ? s.permissions : [],
    }));
  })();

  const pendingInvites: PendingInvite[] = (() => {
    const raw: any = invitesData?.data;
    const list: any[] = Array.isArray(raw) ? raw : [];
    return list
      .filter((i: any) => ['PENDING', 'SENT'].includes((i.status || '').toUpperCase()))
      .map((i: any) => ({ id: i.id || i._id, email: i.email, phone: i.phone, role: i.role }));
  })();

  const filteredStaff = staff.filter(s => {
    const q = search.toLowerCase();
    return (s.phone || '').includes(search) || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.role.toLowerCase().includes(q);
  });
  const filteredInvites = pendingInvites.filter(i =>
    (i.email || '').includes(search) || (i.phone || '').includes(search) || i.role.toLowerCase().includes(search.toLowerCase())
  );

  const inviteMut = useMutation({
    mutationFn: async () => {
      const trimmedEmail = inviteForm.email.trim();
      const trimmedPhone = inviteForm.phone.trim();
      // Use businessId from auth context (set on login). Fall back to profile fetch only if missing.
      let businessId: string | undefined = (user as any)?.businessId;
      if (!businessId) {
        const profileRes = await getBusinessProfile();
        const d: any = profileRes?.data;
        // data.business.id is the actual Business id; data.id is the BusinessProfile's own id
        businessId = d?.business?.id || d?.business?._id || d?.businessId || d?._id;
      }
      if (!businessId) throw new Error("Your business profile couldn't be loaded. Please sign out and sign back in.");
      const roleObj = rolesList.find((r: any) => r.value === inviteForm.role);
      const res: any = await inviteStaff({
        businessId,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined,
        name: inviteForm.name.trim() || undefined,
        role: inviteForm.role.toUpperCase(),
        roleId: roleObj?.id,
        permissions: invitePerms,
      });
      if (!res.success) throw new Error(res.message || "We couldn't send the invitation. Please try again.");
      return res;
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      const token = res.data?.token || res.data?.inviteToken || res.token;
      setShowInvite(false);
      setInviteForm({ email: '', phone: '', name: '', role: rolesList[0]?.value || 'STAFF' });
      setInvitePerms(DEFAULT_INVITE_PERMS);
      if (token) setShareModal({ visible: true, token });
      else toast.success('Invitation sent! Ask them to check their email.');
    },
    onError: (e: any) => toast.error(e?.message || "We couldn't send the invitation. Please try again."),
  });

  const removeMut = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('The staff member has been removed from your business.'); },
    onError: () => toast.error("We couldn't remove this staff member. Please try again."),
  });

  const savePermsMut = useMutation({
    mutationFn: () => updateStaffPermissions(editingStaff!.id, editPerms),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      toast.success(`Permissions updated for ${editingStaff?.name || editingStaff?.email || 'staff member'}.`);
      setEditingStaff(null);
    },
    onError: () => toast.error("We couldn't save the permissions. Please try again."),
  });

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      const res: any = await resendInvite(id);
      if (res.success) {
        const token = res.data?.token;
        if (token) setShareModal({ visible: true, token });
        else toast.success('The invitation has been resent. Ask your staff to check their email.');
      } else {
        toast.error(res.message || "We couldn't resend the invitation. Please try again.");
      }
    } catch {
      toast.error("We couldn't resend the invitation. Check your connection and try again.");
    } finally {
      setResendingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    qc.setQueryData(['invitations'], (old: any) => {
      if (!old) return old;
      const list = Array.isArray(old.data) ? old.data : [];
      return { ...old, data: list.filter((i: any) => (i.id || i._id) !== id) };
    });
    try {
      await revokeInvite(id);
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      toast.error(e?.message || "We couldn't revoke this invitation. Please try again.");
    }
  };

  const inviteLink = (token: string) => `https://easepay-website.vercel.app/invite/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(inviteLink(token));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const shareWhatsApp = (token: string) => {
    const text = encodeURIComponent(`You've been invited to join our business on EasePay!\n\nTap this link to accept:\n${inviteLink(token)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareNative = async (token: string) => {
    const link = inviteLink(token);
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try { await (navigator as any).share({ title: 'EasePay Staff Invitation', text: "You've been invited to join our business on EasePay!", url: link }); } catch {}
    } else {
      copyLink(token);
      toast.success('Link copied to clipboard');
    }
  };

  const togglePerm = (id: string, perms: string[], setPerms: (p: string[]) => void) => {
    setPerms(perms.includes(id) ? perms.filter(p => p !== id) : [...perms, id]);
  };

  if (!isOwner) {
    return (
      <div className="max-w-2xl flex flex-col items-center justify-center py-24 text-center mx-auto">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={26} className="text-gray-400" />
        </div>
        <p className="text-gray-800 font-semibold">Owner Access Only</p>
        <p className="text-gray-400 text-sm mt-1.5 max-w-xs">Staff management is restricted to the business owner.</p>
      </div>
    );
  }

  const loading = activeTab === 'Active' ? staffLoading : invitesLoading;
  const canSend = !inviteMut.isPending && (!!inviteForm.email.trim() || !!inviteForm.phone.trim());

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-gray-900">Manage Staff</h1>
          <p className="text-xs text-gray-400">Invite team members and control what they can access</p>
        </div>
        {canSub('staffInvite') ? (
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-medium hover:bg-[#0a1460] transition-colors shrink-0">
            <UserPlus size={16} /> Invite Staff
          </button>
        ) : (
          <Link href="/dashboard/settings/subscription"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors shrink-0">
            <Lock size={16} /> Upgrade to Invite
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {(['Active', 'Pending'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-[#050A30] text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <Search size={16} className="text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={activeTab === 'Active' ? 'Search staff...' : 'Search invites...'}
          className="flex-1 text-sm outline-none placeholder:text-gray-400"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : activeTab === 'Active' ? (
          filteredStaff.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No staff members found</p>
              <button onClick={() => setShowInvite(true)} className="text-sm text-[#3B82F6] font-medium mt-2 hover:underline">Add your first staff member</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredStaff.map(member => {
                const displayName = member.name || member.email || member.phone || '—';
                return (
                  <div key={member.id} className="flex items-center justify-between px-4 py-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold shrink-0">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                        <p className="text-xs text-[#3B82F6] font-medium">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setEditingStaff(member); setEditPerms(member.permissions); }}
                        className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-[#3B82F6] transition-colors"
                        title="Edit permissions"
                      >
                        <Key size={16} />
                      </button>
                      <button
                        onClick={() => { if (confirm('Are you sure you want to remove this staff member?')) removeMut.mutate(member.id); }}
                        className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : filteredInvites.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Inbox size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No pending invitations found</p>
            <button onClick={() => setShowInvite(true)} className="text-sm text-[#3B82F6] font-medium mt-2 hover:underline">Invite a new staff member</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredInvites.map(invite => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center text-yellow-600 shrink-0">
                    <Mail size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{invite.email || invite.phone || 'Pending Invite'}</p>
                    <p className="text-xs text-[#3B82F6] font-medium">{invite.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleResend(invite.id)}
                    disabled={resendingId === invite.id}
                    className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-[#3B82F6] transition-colors disabled:opacity-60"
                    title="Resend invite"
                  >
                    {resendingId === invite.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                    title="Revoke invite"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-sm font-bold text-gray-900">Invite Staff</h3>
              <button onClick={() => setShowInvite(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Assign Role</label>
                <select
                  value={inviteForm.role}
                  onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]"
                >
                  {rolesList.map((r: any) => <option key={r.value || r.id} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@email.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number <span className="text-gray-400 font-normal">(optional if email given)</span></label>
                <input type="tel" value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder="+2348012345678"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={inviteForm.name} onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Custom Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSIONS_LIST.map(p => {
                    const active = invitePerms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePerm(p.id, invitePerms, setInvitePerms)}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${active ? 'border-[#3B82F6] bg-blue-50' : 'border-gray-200'}`}
                      >
                        <span className={`text-xs font-medium ${active ? 'text-[#050A30]' : 'text-gray-600'}`}>{p.label}</span>
                        <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${active ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-gray-300'}`}>
                          {active && <Check size={10} className="text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={() => inviteMut.mutate()} disabled={!canSend}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
                {inviteMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : <><Send size={15} /> Send Invite</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingStaff(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <p className="text-xs text-gray-400">Editing permissions for</p>
                <h3 className="text-sm font-bold text-gray-900">{editingStaff.name || editingStaff.email || 'Staff Member'}</h3>
              </div>
              <button onClick={() => setEditingStaff(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-2">
              {PERMISSIONS_LIST.map(p => {
                const active = editPerms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerm(p.id, editPerms, setEditPerms)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${active ? 'border-[#3B82F6] bg-blue-50' : 'border-gray-200'}`}
                  >
                    <span className={`text-sm font-medium ${active ? 'text-[#050A30]' : 'text-gray-600'}`}>{p.label}</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${active ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-gray-300'}`}>
                      {active && <Check size={12} className="text-white" />}
                    </span>
                  </button>
                );
              })}
              <button onClick={() => savePermsMut.mutate()} disabled={savePermsMut.isPending}
                className="w-full mt-2 py-3 bg-[#3B82F6] text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
                {savePermsMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Invite Link Modal */}
      {shareModal.visible && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShareModal({ visible: false, token: '' })}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Invitation Created!</h3>
              <button onClick={() => setShareModal({ visible: false, token: '' })} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">Share this link directly with your staff member — email delivery may take a few minutes.</p>

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">Invite Link</p>
                  <p className="text-sm text-emerald-600 font-semibold truncate">{inviteLink(shareModal.token)}</p>
                </div>
                <button onClick={() => copyLink(shareModal.token)} className={`p-2 rounded-lg transition-colors shrink-0 ${linkCopied ? 'bg-blue-600 text-white' : 'bg-blue-50 text-[#3B82F6]'}`}>
                  {linkCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <button onClick={() => shareWhatsApp(shareModal.token)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold hover:opacity-90 transition-opacity">
                <MessageCircle size={17} /> Share via WhatsApp
              </button>
              <button onClick={() => shareNative(shareModal.token)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#3B82F6] text-white text-sm font-bold hover:bg-blue-600 transition-colors">
                <Share2 size={17} /> Share Link
              </button>
              <button onClick={() => setShareModal({ visible: false, token: '' })} className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold hover:bg-gray-200 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

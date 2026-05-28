'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeamMembers, removeTeamMember, inviteTeamMember, getInvitations, resendInvite, revokeInvite, updateStaffPermissions } from '@/services/apiService';
import { ChevronLeft, Users, Plus, Trash2, Loader2, X, Mail, Phone, RefreshCw, Shield, Check } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

const ALL_PERMISSIONS = [
  { key: 'VIEW_DASHBOARD', label: 'View Dashboard', group: 'General' },
  { key: 'RECORD_SALES', label: 'Record Sales', group: 'Sales' },
  { key: 'VIEW_SALES', label: 'View Sales', group: 'Sales' },
  { key: 'ADD_EXPENSES', label: 'Add Expenses', group: 'Expenses' },
  { key: 'VIEW_EXPENSES', label: 'View Expenses', group: 'Expenses' },
  { key: 'MANAGE_INVENTORY', label: 'Manage Inventory', group: 'Stock' },
  { key: 'VIEW_INVENTORY', label: 'View Inventory', group: 'Stock' },
  { key: 'CREATE_INVOICES', label: 'Create Invoices', group: 'Invoices' },
  { key: 'VIEW_INVOICES', label: 'View Invoices', group: 'Invoices' },
  { key: 'VIEW_REPORTS', label: 'View Reports', group: 'Reports' },
  { key: 'MANAGE_STAFF', label: 'Manage Staff', group: 'Admin' },
  { key: 'MANAGE_SETTINGS', label: 'Manage Settings', group: 'Admin' },
];

const ROLE_PRESETS: Record<string, string[]> = {
  CASHIER: ['VIEW_DASHBOARD', 'RECORD_SALES', 'VIEW_SALES', 'VIEW_INVENTORY'],
  MANAGER: ['VIEW_DASHBOARD', 'RECORD_SALES', 'VIEW_SALES', 'ADD_EXPENSES', 'VIEW_EXPENSES', 'MANAGE_INVENTORY', 'VIEW_INVENTORY', 'CREATE_INVOICES', 'VIEW_INVOICES', 'VIEW_REPORTS'],
  ACCOUNTANT: ['VIEW_DASHBOARD', 'VIEW_SALES', 'VIEW_EXPENSES', 'VIEW_REPORTS', 'VIEW_INVOICES'],
  ADMIN: ALL_PERMISSIONS.map(p => p.key),
};

const groups = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

export default function RolesPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', phone: '', role: 'CASHIER' });
  const [selectedPerms, setSelectedPerms] = useState<string[]>(ROLE_PRESETS['CASHIER']);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: staffData, isLoading } = useQuery({ queryKey: ['staff'], queryFn: getTeamMembers });
  const { data: invitesData } = useQuery({ queryKey: ['invitations'], queryFn: getInvitations });

  const inviteMut = useMutation({
    mutationFn: () => inviteTeamMember(inviteForm.email, inviteForm.role, inviteForm.phone || undefined, selectedPerms),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff', 'invitations'] }); setShowInvite(false); setInviteForm({ email: '', phone: '', role: 'CASHIER' }); toast.success('Invitation sent!'); },
    onError: (e: any) => toast.error(e.message || 'Failed to send invite'),
  });

  const removeMut = useMutation({
    mutationFn: removeTeamMember,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); toast.success('Staff removed'); },
    onError: () => toast.error('Failed to remove staff'),
  });

  const resendMut = useMutation({
    mutationFn: resendInvite,
    onSuccess: () => toast.success('Invitation resent'),
    onError: () => toast.error('Failed to resend'),
  });

  const revokeMut = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invitations'] }); toast.success('Invitation revoked'); },
    onError: () => toast.error('Failed to revoke'),
  });

  const updatePermsMut = useMutation({
    mutationFn: ({ id, perms }: any) => updateStaffPermissions(id, perms),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); setEditingStaff(null); toast.success('Permissions updated'); },
    onError: () => toast.error('Failed to update permissions'),
  });

  const staff = (staffData?.data as any)?.staff || staffData?.data || [];
  const invitations = (invitesData?.data as any)?.invitations || invitesData?.data || [];

  const applyPreset = (role: string, permsState: string[], setPerms: (p: string[]) => void) => {
    setPerms(ROLE_PRESETS[role] || []);
  };

  const togglePerm = (key: string, perms: string[], setPerms: (p: string[]) => void) => {
    setPerms(perms.includes(key) ? perms.filter(p => p !== key) : [...perms, key]);
  };

  return (
    <div className="max-w-2xl space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft size={18} className="text-gray-600" /></Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">Staff & Roles</h1>
            <p className="text-xs text-gray-400">Manage team access and permissions</p>
          </div>
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#050A30] text-white rounded-lg text-sm font-semibold hover:bg-[#0a1460] transition-colors">
          <Plus size={14} /> Invite
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
          <Users size={15} className="text-gray-500" />
          <h3 className="text-sm font-bold text-gray-900">Team Members</h3>
          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{staff.length}</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" /></div>
        ) : staff.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No team members yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {staff.map((member: any) => (
              <div key={member.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-[#050A30] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {(member.firstName || member.name || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{member.email || member.phone}</p>
                </div>
                <span className="text-xs bg-[#050A30]/10 text-[#050A30] px-2 py-0.5 rounded-full font-semibold">{member.role}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingStaff(member); setEditPerms(member.permissions || ROLE_PRESETS[member.role] || []); }}
                    className="p-1.5 text-gray-400 hover:text-[#050A30] hover:bg-gray-100 rounded-lg transition-colors" title="Edit permissions">
                    <Shield size={13} />
                  </button>
                  <button onClick={() => { if (confirm('Remove this staff member?')) removeMut.mutate(member.id || member.userId); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <Mail size={15} className="text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900">Pending Invitations</h3>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">{invitations.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3 group">
                <div className="w-9 h-9 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center flex-shrink-0">
                  <Mail size={14} className="text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-400">{inv.role} · Pending</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => resendMut.mutate(inv.id)} disabled={resendMut.isPending}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Resend">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={() => { if (confirm('Revoke this invitation?')) revokeMut.mutate(inv.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Revoke">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Invite Team Member</h3>
              <button onClick={() => setShowInvite(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address *</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} placeholder="colleague@example.com"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone (optional)</label>
                <input type="tel" value={inviteForm.phone} onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(ROLE_PRESETS).map(role => (
                    <button key={role} type="button" onClick={() => { setInviteForm(f => ({ ...f, role })); applyPreset(role, selectedPerms, setSelectedPerms); }}
                      className={`py-2 rounded-xl border-2 text-xs font-bold transition-all ${inviteForm.role === role ? 'border-[#050A30] bg-[#050A30] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Permissions</label>
                <div className="space-y-3">
                  {groups.map(group => (
                    <div key={group}>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">{group}</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ALL_PERMISSIONS.filter(p => p.group === group).map(p => (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                            <div onClick={() => togglePerm(p.key, selectedPerms, setSelectedPerms)}
                              className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${selectedPerms.includes(p.key) ? 'bg-[#050A30] border-[#050A30]' : 'border-gray-300 bg-white'}`}>
                              {selectedPerms.includes(p.key) && <Check size={10} className="text-white" />}
                            </div>
                            <span className="text-xs text-gray-700">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => inviteMut.mutate()} disabled={!inviteForm.email || inviteMut.isPending}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
                {inviteMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingStaff(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Edit Permissions — {editingStaff.firstName}</h3>
              <button onClick={() => setEditingStaff(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {Object.keys(ROLE_PRESETS).map(role => (
                  <button key={role} type="button" onClick={() => setEditPerms(ROLE_PRESETS[role])}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    {role}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {groups.map(group => (
                  <div key={group}>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">{group}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ALL_PERMISSIONS.filter(p => p.group === group).map(p => (
                        <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                          <div onClick={() => togglePerm(p.key, editPerms, setEditPerms)}
                            className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors ${editPerms.includes(p.key) ? 'bg-[#050A30] border-[#050A30]' : 'border-gray-300 bg-white'}`}>
                            {editPerms.includes(p.key) && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-xs text-gray-700">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => updatePermsMut.mutate({ id: editingStaff.id || editingStaff.userId, perms: editPerms })} disabled={updatePermsMut.isPending}
                className="w-full py-3 bg-[#050A30] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#0a1460] transition-colors">
                {updatePermsMut.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

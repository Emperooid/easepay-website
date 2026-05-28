'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeamMembers, inviteTeamMember, removeTeamMember } from '@/services/apiService';
import { Loader2, UserPlus, X, Users, Trash2 } from 'lucide-react';

export default function StaffPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'STAFF', phone: '' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['staff'], queryFn: getTeamMembers });
  const inviteMut = useMutation({
    mutationFn: () => inviteTeamMember(form.email, form.role, form.phone),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); setShowInvite(false); setForm({ email: '', role: 'STAFF', phone: '' }); },
  });
  const removeMut = useMutation({ mutationFn: removeTeamMember, onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }) });

  const staff = (data?.data as any)?.staff || (data as any)?.staff || data?.data || [];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 bg-[#050A30] text-white rounded-lg text-sm font-medium hover:bg-[#0a1460] transition-colors">
          <UserPlus size={16} /> Invite Staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-gray-400"><Users size={40} className="mx-auto mb-3 opacity-50" /><p className="text-sm">No staff members yet</p></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {staff.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between px-4 py-3 group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-semibold">
                    {(member.firstName || member.email || 'S')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.firstName} {member.lastName || ''}</p>
                    <p className="text-xs text-gray-400">{member.email || member.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{member.staffRole || member.role}</span>
                  <button onClick={() => removeMut.mutate(member.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Invite Staff</h3>
              <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@email.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#050A30]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button onClick={() => inviteMut.mutate()} disabled={!form.email || inviteMut.isPending} className="w-full py-2.5 bg-[#050A30] text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                {inviteMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

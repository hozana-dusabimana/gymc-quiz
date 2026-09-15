import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMutation } from '@/hooks/useApi';
import { Users } from '@/lib/services';
import { PageHeader } from '@/components/common';
import { Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [prefix, setPrefix] = useState(user?.prefix || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const save = useMutation(Users.updateProfile);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await save.mutate({
        name: name.trim(),
        phone: phone.trim() || null,
        prefix: prefix.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      updateUser(updated);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update profile');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      <PageHeader title="Profile" subtitle="Manage your account details" />

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4 text-xs">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border" />
          ) : (
            <span className="w-16 h-16 rounded-full bg-slate-800 text-white text-lg font-bold flex items-center justify-center">
              {(name || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          )}
          <div>
            <div className="font-bold text-sm text-slate-900">{user?.email}</div>
            <div className="text-slate-500 capitalize">{user?.role}{user?.memberNumber ? ` • ${user.memberNumber}` : ''}</div>
          </div>
        </div>

        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Full name</span>
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>
        {user?.role === 'leader' && (
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Title / prefix</span>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Dr." className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
        )}
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Avatar URL</span>
          <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={save.loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center gap-2"
          >
            {save.loading && <Spinner />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

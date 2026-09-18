import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { Admin, type StaffUser } from '@/lib/services';
import { PageHeader, Badge, Modal } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/format';

export function AdminDashboardPage() {
  const { data, loading, error, refetch } = useQuery(() => Admin.list(), []);
  const toast = useToast();
  const create = useMutation(Admin.create);
  const [editing, setEditing] = useState<StaffUser | null>(null);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'leader' as 'leader' | 'admin' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await create.mutate(form);
      toast.success(`${user.role === 'admin' ? 'Admin' : 'Leader'} account created for ${user.name}`);
      setForm({ name: '', email: '', phone: '', password: '', role: 'leader' });
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create account');
    }
  };

  const toggleActive = async (u: StaffUser) => {
    try {
      await Admin.update(u.id, { isActive: !u.isActive });
      toast.success(u.isActive ? `${u.name} deactivated` : `${u.name} reactivated`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update account');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Admin"
        subtitle="Create and manage choir leader & administrator accounts"
        actions={
          <Link
            to="/members"
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs shadow-xs flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base text-amber-600">groups</span>
            Manage members
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">person_add</span>
              </div>
              <h3 className="font-bold text-sm text-slate-900">New leader or admin</h3>
            </div>
            <form onSubmit={submit} className="space-y-3 text-xs">
              <label className="block">
                <span className="font-semibold text-slate-700 block mb-1">Full name</span>
                <input required minLength={2} value={form.name} onChange={set('name')} className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700 block mb-1">Email</span>
                <input required type="email" value={form.email} onChange={set('email')} className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700 block mb-1">Phone</span>
                <input required minLength={6} value={form.phone} onChange={set('phone')} placeholder="e.g. 0788123456" className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700 block mb-1">Temporary password</span>
                <input required minLength={6} type="text" value={form.password} onChange={set('password')} className="w-full p-2.5 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-700 block mb-1">Role</span>
                <select value={form.role} onChange={set('role')} className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100">
                  <option value="leader">Choir leader</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={create.loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {create.loading && <Spinner />}
                Create account
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          {loading && <LoadingState />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {!loading && !error && (data?.length ?? 0) === 0 && (
            <EmptyState icon="group" title="No leaders or admins yet" description="Create the first one on the left." />
          )}
          {!loading && !error && (data?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Courses</th>
                    <th className="p-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data || []).map((u) => (
                    <tr key={u.id} className={`hover:bg-slate-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[10px] text-slate-400">
                          Joined {formatDate(u.createdAt)} · {u.lastLoginAt ? `active ${timeAgo(u.lastLoginAt)}` : 'never signed in'}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">
                        <div>{u.email}</div>
                        {u.phone && <div className="text-[10px] text-slate-400">{u.phone}</div>}
                      </td>
                      <td className="p-3">
                        <Badge tone={u.role === 'admin' ? 'amber' : 'indigo'}>{u.role}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge tone={u.isActive ? 'emerald' : 'rose'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>
                      </td>
                      <td className="p-3 text-slate-600 font-semibold">{u.coursesCount}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setEditing(u)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg" title="Edit">
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            className={`p-1.5 rounded-lg ${u.isActive ? 'text-slate-400 hover:text-rose-600' : 'text-slate-400 hover:text-emerald-600'}`}
                            title={u.isActive ? 'Deactivate' : 'Reactivate'}
                          >
                            <span className="material-symbols-outlined text-base">{u.isActive ? 'block' : 'restart_alt'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditStaffModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function EditStaffModal({ user, onClose, onSaved }: { user: StaffUser; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const isSelf = me?.id === user.id;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [role, setRole] = useState<'member' | 'leader' | 'admin'>(user.role);
  const save = useMutation(Admin.update);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save.mutate(user.id, { name, email, phone, role });
      toast.success('Account updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update account');
    }
  };

  return (
    <Modal title={`Edit ${user.name}`} icon="edit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-xs" id="edit-staff-form">
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Full name</span>
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Phone</span>
          <input required minLength={6} value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-300" />
        </label>
        <label className="block">
          <span className="font-semibold text-slate-700 block mb-1">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'member' | 'leader' | 'admin')}
            disabled={isSelf}
            className="w-full p-2.5 rounded-xl border border-slate-300 bg-white disabled:opacity-60"
          >
            <option value="member">Choir member</option>
            <option value="leader">Choir leader</option>
            <option value="admin">Administrator</option>
          </select>
          {isSelf && <span className="block mt-1 text-[10px] text-slate-400">You cannot change your own role.</span>}
        </label>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.loading}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-60"
          >
            {save.loading && <Spinner />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}

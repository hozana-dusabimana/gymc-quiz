import { useState } from 'react';
import { useQuery, useMutation } from '@/hooks/useApi';
import { Admin } from '@/lib/services';
import { PageHeader, Badge } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';

export function AdminDashboardPage() {
  const { data, loading, error, refetch } = useQuery(() => Admin.list(), []);
  const toast = useToast();
  const create = useMutation(Admin.create);

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

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Admin"
        subtitle="Create and manage choir leader & administrator accounts"
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
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data || []).map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{u.name}</td>
                      <td className="p-3 text-slate-500">
                        <div>{u.email}</div>
                        {u.phone && <div className="text-[10px] text-slate-400">{u.phone}</div>}
                      </td>
                      <td className="p-3">
                        <Badge tone={u.role === 'admin' ? 'amber' : 'indigo'}>{u.role}</Badge>
                      </td>
                      <td className="p-3 text-slate-500">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { Members, type MemberUser, type MemberDetail } from '@/lib/services';
import { PageHeader, Badge, Modal } from '@/components/common';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api';
import { formatDate, timeAgo, pct } from '@/lib/format';

const ROLE_TONE = { member: 'slate', leader: 'indigo', admin: 'amber' } as const;
const ROLE_LABEL = { member: 'Member', leader: 'Leader', admin: 'Admin' } as const;

export function MembersPage() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const { data, loading, error, refetch } = useQuery(() => Members.list(), []);
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<MemberUser | null>(null);
  const [editing, setEditing] = useState<MemberUser | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data || [];
    return (data || []).filter((m) =>
      [m.name, m.email, m.phone, m.memberNumber].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [data, query]);

  const toggleActive = async (m: MemberUser) => {
    try {
      await Members.update(m.id, { isActive: !m.isActive });
      toast.success(m.isActive ? `${m.name} deactivated` : `${m.name} reactivated`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update member');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Members"
        subtitle={isAdmin ? 'View, edit and manage every account — members, leaders and admins' : 'View, edit and manage choir member accounts'}
      />

      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={refetch} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState icon="group" title="No members yet" description="Members appear here once they register." />
      )}

      {!loading && !error && (data?.length ?? 0) > 0 && (
        <>
          <div className="relative max-w-md">
            <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, phone or member number…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            {/* Mobile: stacked cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map((m) => {
                const isSelf = m.id === me?.id;
                return (
                  <div key={m.id} className={`p-3.5 space-y-2.5 ${!m.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {m.role === 'member' ? m.memberNumber || 'No member #' : ROLE_LABEL[m.role]} · joined {formatDate(m.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setViewing(m)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg" title="View details">
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>
                        <button onClick={() => setEditing(m)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg" title="Edit">
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => toggleActive(m)}
                          disabled={isSelf}
                          className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${m.isActive ? 'text-slate-400 hover:text-rose-600' : 'text-slate-400 hover:text-emerald-600'}`}
                          title={isSelf ? 'You cannot deactivate your own account' : m.isActive ? 'Deactivate' : 'Reactivate'}
                        >
                          <span className="material-symbols-outlined text-base">{m.isActive ? 'block' : 'restart_alt'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-slate-500">
                      <div className="truncate">{m.email}</div>
                      {m.phone && <div className="text-[10px] text-slate-400">{m.phone}</div>}
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {isAdmin && <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>}
                      <Badge tone={m.isActive ? 'emerald' : 'rose'}>{m.isActive ? 'Active' : 'Deactivated'}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Courses</div>
                        <div className="font-semibold text-slate-700">{m.coursesCount}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Quizzes</div>
                        <div className="font-semibold text-slate-700">{m.quizzesTaken}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Average</div>
                        <div className="font-bold text-slate-900">{m.averageScore != null ? pct(m.averageScore, 1) : '—'}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tablet/desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Contact</th>
                    {isAdmin && <th className="p-3">Role</th>}
                    <th className="p-3">Courses</th>
                    <th className="p-3">Quizzes</th>
                    <th className="p-3">Average</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => {
                    const isSelf = m.id === me?.id;
                    return (
                    <tr key={m.id} className={`hover:bg-slate-50 ${!m.isActive ? 'opacity-50' : ''}`}>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {m.role === 'member' ? m.memberNumber || 'No member #' : ROLE_LABEL[m.role]} · joined {formatDate(m.createdAt)}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">
                        <div>{m.email}</div>
                        {m.phone && <div className="text-[10px] text-slate-400">{m.phone}</div>}
                      </td>
                      {isAdmin && (
                        <td className="p-3">
                          <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                        </td>
                      )}
                      <td className="p-3 text-slate-600 font-semibold">{m.coursesCount}</td>
                      <td className="p-3 text-slate-600 font-semibold">{m.quizzesTaken}</td>
                      <td className="p-3 font-bold text-slate-900">{m.averageScore != null ? pct(m.averageScore, 1) : '—'}</td>
                      <td className="p-3">
                        <Badge tone={m.isActive ? 'emerald' : 'rose'}>{m.isActive ? 'Active' : 'Deactivated'}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setViewing(m)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg" title="View details">
                            <span className="material-symbols-outlined text-base">visibility</span>
                          </button>
                          <button onClick={() => setEditing(m)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg" title="Edit">
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => toggleActive(m)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${m.isActive ? 'text-slate-400 hover:text-rose-600' : 'text-slate-400 hover:text-emerald-600'}`}
                            title={isSelf ? 'You cannot deactivate your own account' : m.isActive ? 'Deactivate' : 'Reactivate'}
                          >
                            <span className="material-symbols-outlined text-base">{m.isActive ? 'block' : 'restart_alt'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">No members match "{query}".</div>
            )}
          </div>
        </>
      )}

      {viewing && <MemberDetailModal id={viewing.id} onClose={() => setViewing(null)} />}
      {editing && (
        <EditMemberModal
          member={editing}
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

function MemberDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading, error } = useQuery<MemberDetail>(() => Members.get(id), [id]);

  return (
    <Modal title="Member details" icon="person" onClose={onClose} wide>
      {loading && <LoadingState className="py-8" />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="space-y-5 text-xs">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-slate-800 text-white text-sm font-bold flex items-center justify-center">
              {data.member.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <div>
              <div className="font-bold text-sm text-slate-900">{data.member.name}</div>
              <div className="text-slate-500">{data.member.email}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Phone</div>
              <div className="font-semibold text-slate-800 mt-0.5">{data.member.phone || '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Member #</div>
              <div className="font-semibold text-slate-800 mt-0.5">{data.member.memberNumber || '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Joined</div>
              <div className="font-semibold text-slate-800 mt-0.5">{formatDate(data.member.createdAt)}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Last active</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {data.member.lastLoginAt ? timeAgo(data.member.lastLoginAt) : 'Never signed in'}
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-2">Enrolled courses ({data.courses.length})</h4>
            {data.courses.length === 0 ? (
              <p className="text-slate-400">Not enrolled in any course yet.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {data.courses.map((c) => (
                  <div key={c.id} className="p-2.5 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      <span className="font-mono text-slate-400">{c.code}</span> · {c.title}
                    </span>
                    <span className="text-slate-500">{c.averageScore != null ? pct(c.averageScore, 1) : 'No attempts'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditMemberModal({ member, onClose, onSaved }: { member: MemberUser; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const isSelf = me?.id === member.id;
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(member.phone || '');
  const [memberNumber, setMemberNumber] = useState(member.memberNumber || '');
  const [role, setRole] = useState<'member' | 'leader' | 'admin'>(member.role);
  const save = useMutation(Members.update);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: Parameters<typeof Members.update>[1] = { name, email, phone, memberNumber: memberNumber || null };
      if (isAdmin && role !== member.role) body.role = role;
      await save.mutate(member.id, body);
      toast.success(isAdmin && role !== member.role ? `${name} is now a ${role}` : 'Member updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update member');
    }
  };

  return (
    <Modal title={`Edit ${member.name}`} icon="edit" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-xs">
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
        {member.role === 'member' && (
          <label className="block">
            <span className="font-semibold text-slate-700 block mb-1">Member number</span>
            <input value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} placeholder="e.g. GYMC/001" className="w-full p-2.5 rounded-xl border border-slate-300" />
          </label>
        )}
        {isAdmin && (
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
        )}
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

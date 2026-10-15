import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
  X,
  XCircle,
} from 'lucide-react';
import api from '../api/axios';

const PAGE_SIZE = 8;
type AccountType = 'STUDENT' | 'ADMIN';
type EnrollmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = 'ALL' | EnrollmentStatus;
type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: EnrollmentStatus;
  profileImage: string | null;
  createdAt: string;
}

interface AccountTableState {
  users: UserData[];
  search: string;
  status: StatusFilter;
  roleFilter: 'ALL' | 'ADMIN' | 'SUPER_ADMIN';
  page: number;
  total: number;
  totalPages: number;
  loading: boolean;
  error: string;
}

const initialTableState: AccountTableState = {
  users: [], search: '', status: 'ALL', roleFilter: 'ALL', page: 1, total: 0,
  totalPages: 1, loading: true, error: '',
};

function useAccountTable(accountType: AccountType) {
  const [state, setState] = useState<AccountTableState>(initialTableState);
  const fetchAccounts = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await api.get('/users', {
        params: {
          accountType,
          page: state.page,
          limit: PAGE_SIZE,
          search: state.search,
          status: accountType === 'STUDENT' ? state.status : 'ALL',
          adminRole: accountType === 'ADMIN' ? state.roleFilter : 'ALL',
        },
      });
      const pagination = response.data.pagination;
      const totalPages = Math.max(1, pagination.totalPages || 1);
      setState((current) => ({
        ...current,
        users: response.data.users,
        total: pagination.total,
        totalPages,
        page: Math.min(current.page, totalPages),
        loading: false,
      }));
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: `Could not load ${accountType === 'STUDENT' ? 'students' : 'administrators'}. Check your connection and retry.`,
      }));
    }
  }, [accountType, state.page, state.search, state.status, state.roleFilter]);

  useEffect(() => { void fetchAccounts(); }, [fetchAccounts]);

  const update = (values: Partial<AccountTableState>) => {
    setState((current) => ({ ...current, ...values }));
  };

  return { ...state, update, refresh: fetchAccounts };
}

interface AccountSectionProps {
  type: AccountType;
  table: ReturnType<typeof useAccountTable>;
  isSuperAdmin: boolean;
  onCreate: () => void;
  onEdit: (user: UserData) => void;
  onDelete: (user: UserData) => void;
  onEnrollmentChange: (user: UserData, status: EnrollmentStatus) => void;
  onRoleChange: (user: UserData, role: 'ADMIN' | 'SUPER_ADMIN') => void;
}

function AccountSection({
  type, table, isSuperAdmin, onCreate, onEdit, onDelete, onEnrollmentChange, onRoleChange,
}: AccountSectionProps) {
  const students = type === 'STUDENT';
  const columnCount = 4;
  const label = students ? 'Students' : 'Administrators';

  return (
    <section className="ui-card overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${students ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
            {students ? <GraduationCap size={19} /> : <ShieldCheck size={19} />}
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900">{label}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{table.total} {table.total === 1 ? 'account' : 'accounts'}</p>
          </div>
          {table.loading && <LoaderCircle size={16} className="animate-spin text-indigo-500" aria-label="Loading" />}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search {label.toLowerCase()}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={table.search}
              onChange={(event) => table.update({ search: event.target.value, page: 1 })}
              className="ui-input pl-9"
              placeholder="Search name, email, phone"
            />
          </label>
          {students && (
            <select
              aria-label="Filter students by enrollment status"
              className="ui-input sm:w-40"
              value={table.status}
              onChange={(event) => table.update({ status: event.target.value as StatusFilter, page: 1 })}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}
          {!students && (
            <select
              aria-label="Filter administrators by role"
              className="ui-input sm:w-40"
              value={table.roleFilter}
              onChange={(event) => table.update({ roleFilter: event.target.value as AccountTableState['roleFilter'], page: 1 })}
            >
              <option value="ALL">All roles</option>
              <option value="ADMIN">Admins</option>
              <option value="SUPER_ADMIN">Super admins</option>
            </select>
          )}
          {(students || isSuperAdmin) && (
            <button type="button" onClick={onCreate} className="ui-button ui-button-primary justify-center">
              <Plus size={16} /> Add {students ? 'student' : 'admin'}
            </button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
              <th className="px-5 py-3.5 sm:px-6">Account</th>
              {!students && <th className="px-5 py-3.5">Role</th>}
              {students && <th className="px-5 py-3.5">Enrollment</th>}
              <th className="px-5 py-3.5">Joined</th>
              <th className="px-5 py-3.5 text-right sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {table.loading ? (
              <tr><td colSpan={columnCount} className="p-12 text-center text-slate-500"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin text-indigo-500" />Loading {label.toLowerCase()}…</td></tr>
            ) : table.error ? (
              <tr><td colSpan={columnCount} className="p-8">
                <div role="alert" className="ui-alert ui-alert-error mx-auto max-w-xl"><AlertCircle size={18} /><span className="flex-1">{table.error}</span><button type="button" onClick={() => void table.refresh()} className="font-semibold underline">Retry</button></div>
              </td></tr>
            ) : table.users.length === 0 ? (
              <tr><td colSpan={columnCount} className="p-12 text-center">
                <UsersIcon size={23} className="mx-auto mb-3 text-slate-400" />
                <p className="font-semibold text-slate-800">No {label.toLowerCase()} found</p>
                <p className="mt-1 text-xs text-slate-500">Adjust the search or filters, or add an account.</p>
              </td></tr>
            ) : table.users.map((user) => (
              <tr key={user.id} className="transition hover:bg-slate-50/70">
                <td className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 font-bold text-indigo-700">
                      {(user.name || user.email).charAt(0).toUpperCase()}
                      {user.profileImage && <img src={user.profileImage} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{user.name || 'Unnamed account'}</span>
                      <span className="block truncate text-xs text-slate-500">{user.email}{user.phone ? ` · ${user.phone}` : ''}</span>
                    </div>
                  </div>
                </td>
                {!students && (
                  <td className="px-5 py-4">
                    {isSuperAdmin ? (
                      <select value={user.role} onChange={(event) => onRoleChange(user, event.target.value as 'ADMIN' | 'SUPER_ADMIN')} className="ui-input min-h-9 py-1 text-xs font-semibold">
                        <option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option>
                      </select>
                    ) : <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{user.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}</span>}
                  </td>
                )}
                {students && (
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${user.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : user.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{user.status}</span>
                  </td>
                )}
                <td className="px-5 py-4 text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-4 sm:px-6">
                  <div className="flex justify-end gap-1">
                    {students && user.status !== 'APPROVED' && (
                      <button type="button" onClick={() => onEnrollmentChange(user, 'APPROVED')} title="Approve student" aria-label={`Approve ${user.email}`} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><Check size={17} /></button>
                    )}
                    {students && user.status !== 'REJECTED' && user.status !== 'APPROVED' && (
                      <button type="button" onClick={() => onEnrollmentChange(user, 'REJECTED')} title="Reject enrollment" aria-label={`Reject ${user.email}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><XCircle size={17} /></button>
                    )}
                    {(students || isSuperAdmin) && <button type="button" onClick={() => onEdit(user)} title="Edit account" aria-label={`Edit ${user.email}`} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"><Pencil size={16} /></button>}
                    {(students || isSuperAdmin) && <button type="button" onClick={() => onDelete(user)} title="Delete account" aria-label={`Delete ${user.email}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="text-xs font-medium text-slate-500">
          Showing {table.total === 0 ? 0 : (table.page - 1) * PAGE_SIZE + 1}–{Math.min(table.page * PAGE_SIZE, table.total)} of {table.total} · Page {table.page} of {table.totalPages}
        </span>
        <div className="flex gap-2 self-end sm:self-auto">
          <button type="button" onClick={() => table.update({ page: Math.max(1, table.page - 1) })} disabled={table.page <= 1 || table.loading} className="ui-button ui-button-secondary min-h-9 px-3 py-1.5 text-xs"><ChevronLeft size={15} /> Previous</button>
          <button type="button" onClick={() => table.update({ page: Math.min(table.totalPages, table.page + 1) })} disabled={table.page >= table.totalPages || table.loading} className="ui-button ui-button-secondary min-h-9 px-3 py-1.5 text-xs">Next <ChevronRight size={15} /></button>
        </div>
      </footer>
    </section>
  );
}

interface AccountForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

const emptyForm: AccountForm = { name: '', email: '', phone: '', password: '', role: 'ADMIN' };

export default function Users({ section = 'both' }: { section?: 'both' | 'students' | 'admins' }) {
  const students = useAccountTable('STUDENT');
  const admins = useAccountTable('ADMIN');
  const isSuperAdmin = localStorage.getItem('role') === 'SUPER_ADMIN';
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [formType, setFormType] = useState<AccountType | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const refresh = async () => { await Promise.all([students.refresh(), admins.refresh()]); };
  const notify = (text: string, error = false) => setNotice({ text, error });

  const beginCreate = (type: AccountType) => {
    setEditingUser(null);
    setForm({ ...emptyForm, role: 'ADMIN' });
    setFormType(type);
    setFormError('');
  };

  const beginEdit = (user: UserData) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, phone: user.phone || '', password: '', role: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN' });
    setFormType(user.role === 'USER' ? 'STUDENT' : 'ADMIN');
    setFormError('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!formType) return;
    setSaving(true);
    setFormError('');
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, { name: form.name, email: form.email, phone: form.phone || null });
        if (formType === 'ADMIN' && isSuperAdmin && form.role !== editingUser.role) {
          await api.patch(`/users/${editingUser.id}/role`, { role: form.role });
        }
        notify('Account details updated.');
      } else {
        await api.post('/users', {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          password: form.password,
          role: formType === 'STUDENT' ? 'USER' : form.role,
        });
        notify(formType === 'STUDENT' ? 'Student account created and marked pending approval.' : 'Administrator account created.');
      }
      setFormType(null);
      setEditingUser(null);
      await refresh();
    } catch (error: any) {
      setFormError(error.response?.data?.error || 'Could not save this account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserData) => {
    const type = user.role === 'USER' ? 'student' : 'administrator';
    if (!window.confirm(`Delete ${type} account for ${user.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      notify(`${type[0].toUpperCase()}${type.slice(1)} account deleted.`);
      await refresh();
    } catch (error: any) {
      notify(error.response?.data?.error || 'Could not delete this account.', true);
    }
  };

  const handleEnrollmentChange = async (user: UserData, status: EnrollmentStatus) => {
    try {
      await api.patch(`/users/${user.id}/enrollment-status`, { status });
      notify(`${user.name || user.email} ${status === 'APPROVED' ? 'approved' : 'rejected'}.`);
      await refresh();
    } catch (error: any) {
      notify(error.response?.data?.error || 'Could not update enrollment status.', true);
    }
  };

  const handleRoleChange = async (user: UserData, role: 'ADMIN' | 'SUPER_ADMIN') => {
    try {
      await api.patch(`/users/${user.id}/role`, { role });
      notify(`Role changed to ${role === 'ADMIN' ? 'Admin' : 'Super admin'}.`);
      await refresh();
    } catch (error: any) {
      notify(error.response?.data?.error || 'Could not update account role.', true);
      await admins.refresh();
    }
  };

  const tableProps = {
    isSuperAdmin,
    onCreate: () => undefined,
    onEdit: beginEdit,
    onDelete: (user: UserData) => void handleDelete(user),
    onEnrollmentChange: (user: UserData, status: EnrollmentStatus) => void handleEnrollmentChange(user, status),
    onRoleChange: (user: UserData, role: 'ADMIN' | 'SUPER_ADMIN') => void handleRoleChange(user, role),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Workspace administration</p>
          <div className="flex items-center gap-2"><h2 className="ui-page-title">{section === 'students' ? 'Students' : section === 'admins' ? 'Administrators' : 'Accounts'}</h2>{isSuperAdmin && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">Super admin</span>}</div>
          <p className="ui-page-description">{section === 'students' ? 'Review enrollment status and manage student accounts.' : section === 'admins' ? 'Manage administrator accounts and access levels.' : 'Manage student enrollments and administrator access from separate directories.'}</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="ui-button ui-button-secondary" disabled={students.loading || admins.loading}><LoaderCircle size={15} className={students.loading || admins.loading ? 'animate-spin' : ''} /> Refresh lists</button>
      </div>

      {notice && <div role={notice.error ? 'alert' : 'status'} className={`ui-alert ${notice.error ? 'ui-alert-error' : 'ui-alert-success'}`}>
        {notice.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span className="flex-1">{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={16} /></button>
      </div>}

      {(section === 'both' || section === 'students') && <AccountSection {...tableProps} type="STUDENT" table={students} onCreate={() => beginCreate('STUDENT')} />}
      {(section === 'both' || section === 'admins') && <AccountSection {...tableProps} type="ADMIN" table={admins} onCreate={() => beginCreate('ADMIN')} />}

      {formType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormType(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="account-form-title" className="ui-card my-auto w-full max-w-lg overflow-hidden shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-600">{formType === 'STUDENT' ? 'Student management' : 'Administrator management'}</p><h3 id="account-form-title" className="text-xl font-bold text-slate-900">{editingUser ? 'Edit account' : `Add ${formType === 'STUDENT' ? 'student' : 'administrator'}`}</h3><p className="mt-1 text-sm text-slate-500">{editingUser ? 'Update account contact information.' : 'Enter the account details below.'}</p></div>
              <button type="button" onClick={() => setFormType(null)} disabled={saving} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </header>
            <form onSubmit={handleSave} className="space-y-4 px-6 py-6">
              {formError && <div role="alert" className="ui-alert ui-alert-error"><AlertCircle size={17} /><span>{formError}</span></div>}
              <div><label className="ui-label" htmlFor="account-name">Full name</label><input id="account-name" required minLength={2} maxLength={100} className="ui-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div><label className="ui-label" htmlFor="account-email">Email address</label><input id="account-email" required type="email" className="ui-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
              <div><label className="ui-label" htmlFor="account-phone">Phone number</label><input id="account-phone" type="tel" maxLength={32} className="ui-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              {!editingUser && <div><label className="ui-label" htmlFor="account-password">Temporary password</label><input id="account-password" required minLength={8} type="password" className="ui-input" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><p className="mt-1 text-xs text-slate-500">At least 8 characters. Student accounts need approval before video access.</p></div>}
              {formType === 'ADMIN' && isSuperAdmin && <div><label className="ui-label" htmlFor="account-role">Administrator role</label><select id="account-role" className="ui-input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AccountForm['role'] })}><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></select></div>}
              <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={() => setFormType(null)} className="ui-button ui-button-secondary">Cancel</button><button type="submit" disabled={saving} className="ui-button ui-button-primary">{saving ? <><LoaderCircle size={16} className="animate-spin" /> Saving…</> : editingUser ? <><Pencil size={15} /> Save changes</> : <><Plus size={16} /> Create account</>}</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

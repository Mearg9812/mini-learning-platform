import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock3, GraduationCap, LoaderCircle, RefreshCw, Search, X } from 'lucide-react';
import api from '../api/axios';

const options = [
  ['FULL_ACCESS', 'Full access'], ['GRADE_9', '9th grade full course'], ['GRADE_10', '10th grade full course'],
  ['GRADE_11', '11th grade full course'], ['GRADE_12', '12th grade full course'], ['FRESHMAN', 'Freshman full course'],
];
const smsWithLinks = (text: string) => text.split(/(https?:\/\/[^\s<>"']+)/gi).map((part, index) =>
  /^https?:\/\//i.test(part)
    ? <a key={index} href={part} target="_blank" rel="noreferrer" className="break-all font-semibold text-indigo-700 underline hover:text-indigo-900">{part}</a>
    : part,
);
interface PaymentRequest {
  id: string; option: string; amount: string; currency: string; receiptText: string; receiptImageUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; approvedOption: string | null; adminNote: string | null; createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
}

export default function Enrollments() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/payment-requests'); setRequests(response.data); }
    catch (requestError: any) { setError(requestError.response?.data?.error || 'We could not load payment receipts.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const review = async (request: PaymentRequest, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(request.id); setError(''); setNotice('');
    try {
      await api.patch(`/payment-requests/${request.id}/review`, { status, adminNote: notes[request.id] || '' });
      setNotice(status === 'APPROVED' ? `${request.user.name || request.user.email} now has access to ${options.find(([key]) => key === request.option)?.[1]}.` : `Receipt from ${request.user.name || request.user.email} was declined.`);
      await loadRequests();
    } catch (requestError: any) { setError(requestError.response?.data?.error || 'Could not update this payment review.'); }
    finally { setBusyId(null); }
  };

  const visible = requests.filter((request) => `${request.user.name} ${request.user.email} ${request.user.phone || ''} ${request.option} ${request.status}`.toLowerCase().includes(query.toLowerCase()));
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;

  return <section className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><GraduationCap size={14} /> Enrollment</div>
      <h2 className="ui-page-title">Payment receipt review</h2><p className="ui-page-description">Open each student request, check the SMS verification link, and manually compare its transaction, amount, and date with the screenshot before approving.</p>
    </div><button type="button" onClick={() => void loadRequests()} disabled={loading} className="ui-button ui-button-secondary self-start sm:self-auto">{loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh</button></div>
    {error && <div role="alert" className="ui-alert ui-alert-error"><AlertCircle size={18} /><span>{error}</span></div>}
    {notice && <div role="status" className="ui-alert ui-alert-success"><CheckCircle2 size={18} /><span>{notice}</span></div>}
    <div className="grid gap-4 sm:grid-cols-3"><div className="ui-card flex items-center gap-3 p-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Clock3 size={20} /></span><div><p className="text-2xl font-bold text-slate-900">{pendingCount}</p><p className="text-xs font-medium text-slate-500">Awaiting review</p></div></div><div className="ui-card flex items-center gap-3 p-5 sm:col-span-2"><label className="relative block w-full"><span className="sr-only">Search receipts</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="ui-input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, email, phone, or course" /></label></div></div>
    <div className="space-y-4">
      {loading && requests.length === 0 ? <div className="ui-card p-12 text-center text-sm text-slate-500">Loading receipts…</div> : visible.length === 0 ? <div className="ui-card p-12 text-center"><CheckCircle2 size={24} className="mx-auto mb-3 text-emerald-600" /><p className="font-semibold text-slate-800">{query ? 'No matching receipts' : 'No payment submissions yet'}</p></div> : visible.map((request) => {
        const statusColor = request.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : request.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
        return <details key={request.id} className="ui-card group overflow-hidden">
          <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 marker:hidden sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden"><div><h3 className="font-bold text-slate-900">{request.user.name || 'Student'} <span className="font-normal text-slate-500">· {request.user.email}</span></h3><p className="mt-1 text-xs text-slate-500">{request.user.phone || 'No phone'} · {request.currency} {request.amount} · {options.find(([key]) => key === request.option)?.[1] || request.option} · {new Date(request.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>{request.status}</span><span className="text-sm font-semibold text-indigo-700">Review receipt ↓</span></div></summary>
          <div className="grid gap-5 border-t border-slate-100 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]"><div className="space-y-3"><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-800">Paid: {request.currency} {request.amount}</span><span className="rounded-lg bg-slate-100 px-3 py-2">Requested: {options.find(([key]) => key === request.option)?.[1] || request.option}</span>{request.approvedOption && <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Granted: {options.find(([key]) => key === request.approvedOption)?.[1]}</span>}</div><div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Bank receipt SMS · tap a link to verify</p><pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">{smsWithLinks(request.receiptText)}</pre></div>{request.adminNote && <p className="text-sm text-slate-600">Admin note: {request.adminNote}</p>}</div>
            <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Screenshot</p><a href={request.receiptImageUrl} target="_blank" rel="noreferrer"><img src={request.receiptImageUrl} alt="Student bank payment receipt screenshot" className="max-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" /></a></div>
            {request.status === 'PENDING' && <div className="space-y-3 rounded-xl bg-slate-50 p-4 lg:col-span-2"><div className="grid gap-3 sm:grid-cols-2"><div><span className="ui-label">Access after approval</span><p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{options.find(([key]) => key === request.option)?.[1] || request.option}</p><p className="mt-1 text-xs text-slate-500">Approval grants only the package selected by the student.</p></div><label><span className="ui-label">Note for student (optional)</span><input className="ui-input" value={notes[request.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Reason or follow-up" /></label></div><div className="flex justify-end gap-2"><button type="button" onClick={() => void review(request, 'REJECTED')} disabled={busyId === request.id} className="ui-button ui-button-danger min-h-10">{busyId === request.id ? <LoaderCircle size={15} className="animate-spin" /> : <X size={16} />} Reject</button><button type="button" onClick={() => void review(request, 'APPROVED')} disabled={busyId === request.id} className="ui-button ui-button-primary min-h-10">{busyId === request.id ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={16} />} Approve access</button></div></div>}
          </div>
        </details>;
      })}
    </div>
  </section>;
}

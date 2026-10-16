import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

export default function Security() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    if (newPassword.length < 8) { setError('Use at least 8 characters for the new password.'); return; }
    if (newPassword !== confirmPassword) { setError('The new passwords do not match.'); return; }
    setSaving(true);
    try {
      const response = await api.patch('/profile/password', { currentPassword, newPassword });
      setMessage(response.data.message || 'Password updated.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Could not update your password.');
    } finally { setSaving(false); }
  };

  return <section className="mx-auto max-w-2xl space-y-6">
    <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"><ShieldCheck size={14} /> Account security</div><h2 className="ui-page-title">Change your password</h2><p className="ui-page-description">Update the password for your administrator account.</p></div>
    <form onSubmit={submit} className="ui-card space-y-4 p-6">
      {error && <div role="alert" className="ui-alert ui-alert-error">{error}</div>}
      {message && <div role="status" className="ui-alert ui-alert-success">{message}</div>}
      <label className="block"><span className="ui-label">Current password</span><input required autoComplete="current-password" type="password" className="ui-input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label className="block"><span className="ui-label">New password</span><input required minLength={8} autoComplete="new-password" type="password" className="ui-input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
      <label className="block"><span className="ui-label">Confirm new password</span><input required minLength={8} autoComplete="new-password" type="password" className="ui-input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      <button type="submit" disabled={saving} className="ui-button ui-button-primary">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />} Update password</button>
    </form>
  </section>;
}

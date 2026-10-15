import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, BookOpen, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import api from '../api/axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/login', { email, password });
      const role = response.data.user.role;
      if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        setError('Student accounts use the Mini Learning app. This dashboard is for administrators.');
        return;
      }
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('role', role);
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      setError(error.response?.data?.error || 'We could not sign you in. Check your email and password, then try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#101827] px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-120 w-120 rounded-full bg-indigo-600/25 blur-[100px]" />
        <div className="absolute -bottom-48 -right-36 h-136 w-136 rounded-full bg-blue-500/15 blur-[110px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-indigo-300/40 to-transparent" />
      </div>

      <div className="relative grid w-full max-w-250 overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-[0_35px_100px_rgba(0,0,0,0.35)] md:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-indigo-600 via-indigo-700 to-slate-900 p-10 text-white md:flex lg:p-12">
          <div aria-hidden="true" className="absolute -right-24 top-24 h-80 w-80 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-12 top-36 h-56 w-56 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><BookOpen size={22} /></span>
            <span>
              <span className="block text-sm font-bold tracking-tight">Mini Learning</span>
              <span className="mt-0.5 block text-[10px] font-bold tracking-[0.2em] text-indigo-100/70">ADMIN CONSOLE</span>
            </span>
          </div>
          <div className="relative max-w-sm py-12">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">Learning, in focus</p>
            <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.04em] lg:text-[3.25rem]">A clearer view of your learning platform.</h1>
            <p className="mt-5 max-w-xs text-sm leading-6 text-indigo-100/75">Manage your video library and keep your community moving forward.</p>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-indigo-100/70"><ShieldCheck size={16} /> Secure administrator access</div>
        </section>

        <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
          <div className="w-full max-w-97.5">
            <div className="mb-8 md:hidden">
              <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><BookOpen size={22} /></div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Mini Learning · Admin</p>
            </div>
            <div className="mb-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Welcome back</p>
              <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-900">Sign in to your account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Use your administrator credentials to continue.</p>
            </div>

            {error && <div role="alert" className="ui-alert ui-alert-error mb-6"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{error}</span></div>}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="ui-label">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@example.com"
                  className="ui-input"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); setError(''); }}
                />
              </div>

              <div>
                <label htmlFor="password" className="ui-label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="ui-input has-trailing-icon"
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="ui-button ui-button-primary mt-2 min-h-12 w-full rounded-xl text-[0.925rem]">
                {loading ? <><LoaderCircle size={18} className="animate-spin" /> Signing in…</> : <>Sign in <ArrowRight size={17} /></>}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <ShieldCheck size={15} /> Secure access for authorized administrators
            </div>
            <p className="mt-5 text-center text-[11px] text-slate-400">© {new Date().getFullYear()} Mini Learning Platform</p>
          </div>
        </section>
      </div>
    </main>
  );
}

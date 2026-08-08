import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, Lock, Mail, Building2, Loader2 } from 'lucide-react';

export default function Login() {
  const { user, loading, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as any)?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      nav(from, { replace: true });
    } catch (err: any) {
      const code = String(err?.code || err?.message || '');
      if (/user-not-found|invalid-credential|wrong-password|invalid-email/i.test(code)) {
        setError('Invalid email or password.');
      } else if (/too-many-requests/i.test(code)) {
        setError('Too many attempts. Try again later.');
      } else if (/network/i.test(code)) {
        setError('Network error. Check your connection.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-800 text-white shadow-lg mb-3">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">PS BillDesk</h1>
          <p className="text-sm text-slate-500 mt-1">Admin login — seller dashboard only</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 sm:p-8 space-y-4"
        >
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
                placeholder="admin@yourbusiness.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold bg-gradient-to-r from-brand-600 to-indigo-700 hover:from-brand-700 hover:to-indigo-800 disabled:opacity-50 shadow-pop"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Customers open invoices via QR / short link — no login needed.
        </p>
      </div>
    </div>
  );
}

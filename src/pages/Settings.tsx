import { useState } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import { useAuth } from '../hooks/useAuth';
import type { BusinessProfile } from '../types';
import { Save, CheckCircle2, Cloud, RefreshCw } from 'lucide-react';

export default function Settings() {
  useDbTick();
  const { user } = useAuth();
  const [p, setP] = useState<BusinessProfile>(db.getBusinessProfile());
  const [saved, setSaved] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncing, setSyncing] = useState(false);

  function save() {
    db.updateBusinessProfile(p);
    setSaved(true);
    void db.forceCloudPush();
    setTimeout(() => setSaved(false), 2500);
  }

  async function syncNow() {
    if (!user) {
      setSyncMsg('Login first');
      return;
    }
    setSyncing(true);
    setSyncMsg('');
    try {
      await db.bindCloudUser(user.uid);
      const ok = await db.forceCloudPush();
      setP(db.getBusinessProfile());
      if (ok) {
        setSyncMsg('OK — data is in Firebase. Open other device, login, refresh.');
      } else {
        setSyncMsg(
          'FAILED — Firebase Console → Firestore → Rules → paste open rules → PUBLISH. Then try again.',
        );
      }
    } catch (e: any) {
      setSyncMsg('FAILED — ' + (e?.message || 'permission denied. Publish Firestore rules.'));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 bg-gradient-to-r from-sky-50 to-indigo-50">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Cloud size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900">Firebase storage (all devices)</div>
            <div className="text-xs text-slate-500 truncate">
              {user?.email ? user.email : 'Not signed in'}
              {db.getCloudUid() ? ' · linked' : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing || !user}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg shrink-0"
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Saving…' : 'Save to cloud'}
          </button>
        </div>
        {syncMsg && (
          <div
            className={
              'px-6 py-3 text-sm font-semibold border-t ' +
              (syncMsg.startsWith('OK')
                ? 'text-emerald-800 bg-emerald-50 border-emerald-100'
                : 'text-rose-800 bg-rose-50 border-rose-100')
            }
          >
            {syncMsg}
          </div>
        )}
        <div className="px-6 py-3 text-xs text-slate-600 leading-relaxed space-y-1">
          <div>
            <b>1.</b> Open{' '}
            <a
              className="text-sky-700 underline font-semibold"
              href="https://console.firebase.google.com/project/ps-billdesk/firestore/rules"
              target="_blank"
              rel="noreferrer"
            >
              Firestore Rules
            </a>
          </div>
          <div>
            <b>2.</b> Paste rules that allow read/write on products, customers, invoices
          </div>
          <div>
            <b>3.</b> Click <b>Publish</b>
          </div>
          <div>
            <b>4.</b> Click <b>Save to cloud</b> here — must say OK
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div
          className="px-6 py-5 border-b border-slate-100"
          style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#1e1b4b 100%)' }}
        >
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">Business Profile</div>
          <div className="text-white text-xl font-extrabold mt-1">Your store on every invoice</div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Business Name *">
            <input className={inp} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inp} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
          </Field>
          <Field label="Address" span>
            <textarea rows={2} className={inp} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
          </Field>
          <Field label="GST Number">
            <input
              className={inp}
              value={p.gstNumber.toUpperCase()}
              onChange={(e) => setP({ ...p, gstNumber: e.target.value })}
            />
          </Field>
          <Field label="Invoice Prefix">
            <input className={inp} value={p.invoicePrefix} onChange={(e) => setP({ ...p, invoicePrefix: e.target.value })} />
          </Field>
          <div className="sm:col-span-2 border-t border-slate-100 pt-5 mt-1">
            <Field label="UPI ID (VPA) *">
              <input
                className={inp + ' font-mono text-brand-700'}
                placeholder="yourname@upi"
                value={p.upiId}
                onChange={(e) => setP({ ...p, upiId: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2 border-t border-slate-100 pt-5 mt-1">
            <Field label="Terms" span>
              <textarea rows={2} className={inp} value={p.terms} onChange={(e) => setP({ ...p, terms: e.target.value })} />
            </Field>
            <Field label="Return Policy" span>
              <textarea rows={2} className={inp} value={p.returnPolicy} onChange={(e) => setP({ ...p, returnPolicy: e.target.value })} />
            </Field>
            <Field label="Footer" span>
              <textarea rows={2} className={inp} value={p.invoiceFooter} onChange={(e) => setP({ ...p, invoiceFooter: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
          {saved && (
            <span className="text-sm font-semibold text-emerald-700 inline-flex items-center gap-1">
              <CheckCircle2 size={16} /> Saved
            </span>
          )}
          <button
            onClick={save}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700"
          >
            <Save size={16} /> Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

const inp =
  'w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm';
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

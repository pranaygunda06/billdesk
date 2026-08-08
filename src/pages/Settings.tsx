import { useState } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import type { BusinessProfile } from '../types';
import { Save, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  useDbTick();
  const [p, setP] = useState<BusinessProfile>(db.getBusinessProfile());
  const [saved, setSaved] = useState(false);

  function save() {
    db.updateBusinessProfile(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100"
          style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#1e1b4b 100%)' }}>
          <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">Business Profile</div>
          <div className="text-white text-xl font-extrabold mt-1">Your store on every invoice</div>
          <div className="text-white/70 text-sm">This info shows on invoices, receipts & WhatsApp messages.</div>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Business Name *">
            <input className={inp} value={p.name} onChange={e => setP({ ...p, name: e.target.value })}/>
          </Field>
          <Field label="Phone">
            <input className={inp} value={p.phone} onChange={e => setP({ ...p, phone: e.target.value })}/>
          </Field>
          <Field label="Address" span>
            <textarea rows={2} className={inp} value={p.address} onChange={e => setP({ ...p, address: e.target.value })}/>
          </Field>
          <Field label="GST Number">
            <input className={inp} value={p.gstNumber.toUpperCase()} onChange={e => setP({ ...p, gstNumber: e.target.value })}/>
          </Field>
          <Field label="Invoice Prefix">
            <input className={inp} value={p.invoicePrefix} onChange={e => setP({ ...p, invoicePrefix: e.target.value })}/>
          </Field>

          <div className="sm:col-span-2 border-t border-slate-100 pt-5 mt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">UPI Payment Setup</div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 mb-4">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                💳 UPI ID for QR code & payment links
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">Works with Google Pay, PhonePe, Paytm, BHIM and all UPI apps.</div>
            </div>
            <Field label="UPI ID (VPA) *">
              <input
                className={inp + ' font-mono text-brand-700'}
                placeholder="yourname@okicici / psenterprises@upi"
                value={p.upiId}
                onChange={e => setP({ ...p, upiId: e.target.value })}
              />
            </Field>
          </div>

          <div className="sm:col-span-2 border-t border-slate-100 pt-5 mt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Invoice Text</div>
            <Field label="Terms & Conditions" span>
              <textarea rows={2} className={inp} value={p.terms} onChange={e => setP({ ...p, terms: e.target.value })}/>
            </Field>
            <Field label="Return Policy" span>
              <textarea rows={2} className={inp} value={p.returnPolicy} onChange={e => setP({ ...p, returnPolicy: e.target.value })}/>
            </Field>
            <Field label="Footer Message" span>
              <textarea rows={2} className={inp} value={p.invoiceFooter} onChange={e => setP({ ...p, invoiceFooter: e.target.value })}/>
            </Field>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
          <div>
            <button
              onClick={() => {
                if (!confirm('Reset all data? Customers, products & invoices will be replaced with fresh demo seed.')) return;
                db.resetDb();
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wider"
            >
              🗑 Reset Demo Data
            </button>
            <div className="text-[11px] text-slate-500 mt-1.5">Use this if anything looks broken (e.g. deleted customer broke invoices).</div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm font-semibold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={16}/> Saved successfully</span>}
            <button
              onClick={save}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 shadow-pop"
            >
              <Save size={16}/> Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm';
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

import { useState } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import { clsx, formatCurrency, generateId } from '../lib/utils';
import { Phone, Search, Plus, UserPlus, Star, StarOff, Trash2, Edit2, MessageCircle, X, Save } from 'lucide-react';
import type { Customer } from '../types';

export default function Customers() {
  useDbTick();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const all = db.getCustomers();
  const filtered = all.filter(c =>
    [c.name, c.phone, c.whatsapp, c.address, c.tags, c.location]
      .join(' ').toLowerCase().includes(q.toLowerCase())
  );

  function openForm(c?: Customer) {
    setEditing(c || empty());
    setOpen(true);
  }

  function save(data: Customer) {
    if (all.some(c => c.id === data.id)) db.updateCustomer(data);
    else db.addCustomer(data);
    setOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, city, tags..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
        </div>
        <button
          onClick={() => openForm()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-pop transition"
        >
          <Plus size={16}/> New Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 hover:shadow-lg transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={clsx(
                  'w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0',
                  c.favorite ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700',
                )}>
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{c.name}</div>
                  <div className="text-xs text-slate-500 truncate">📞 {c.phone || 'No phone'}</div>
                </div>
              </div>
              <button
                onClick={() => { const next = { ...c, favorite: !c.favorite }; db.updateCustomer(next); }}
                className="text-slate-300 hover:text-amber-500 transition"
                title="Toggle favorite"
              >
                {c.favorite ? <Star size={18} fill="#f59e0b" stroke="#f59e0b" /> : <StarOff size={18} />}
              </button>
            </div>

            {c.address && (
              <div className="mt-3 text-xs text-slate-500 line-clamp-2">{c.address}</div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Outstanding</div>
                <div className={clsx(
                  'font-extrabold',
                  c.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700',
                )}>
                  {formatCurrency(c.outstandingBalance)}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${c.phone}`}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                  title="Call"
                >
                  <Phone size={16}/>
                </a>
                <a
                  href={`https://wa.me/${((c.whatsapp || c.phone || '').replace(/\D/g, '').replace(/^91/, '').replace(/^/, '91'))}`}
                  target="_blank" rel="noreferrer"
                  className="w-9 h-9 rounded-lg bg-whatsapp-50 text-whatsapp-700 hover:bg-whatsapp-100 flex items-center justify-center transition"
                  title="WhatsApp"
                >
                  <MessageCircle size={16}/>
                </a>
                <button
                  onClick={() => openForm(c)}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-600 flex items-center justify-center transition"
                  title="Edit"
                >
                  <Edit2 size={16}/>
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`Delete customer ${c.name}?`)) return;
                    try { db.deleteCustomer(c.id); }
                    catch (e: any) { alert(e?.message || 'Cannot delete.'); }
                  }}
                  className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 flex items-center justify-center transition"
                  title="Delete"
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full">
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-14 text-center">
              <UserPlus size={36} className="mx-auto text-slate-300 mb-3"/>
              <div className="text-slate-500 text-sm">{q ? 'No matches found.' : 'No customers yet. Add your first customer to get started.'}</div>
              {!q && (
                <button onClick={() => openForm()} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
                  <Plus size={14}/> Add Customer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {open && <CustomerForm onClose={() => setOpen(false)} initial={editing!} onSave={save} />}
    </div>
  );
}

function empty(): Customer {
  const now = new Date().toISOString();
  return {
    id: generateId('cust_'), name: '', phone: '', whatsapp: '', address: '', gstNumber: '',
    creditLimit: 0, openingBalance: 0, outstandingBalance: 0, notes: '', location: '', tags: '',
    favorite: false, creditDays: 7, createdAt: now,
  };
}

function CustomerForm({ initial, onClose, onSave }: { initial: Customer; onClose: () => void; onSave: (c: Customer) => void }) {
  const [f, setF] = useState<Customer>(initial);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <div className="font-bold text-slate-900">{initial.name ? 'Edit Customer' : 'New Customer'}</div>
            <div className="text-xs text-slate-500">Fill in details to add or update</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X size={18}/></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name *">
            <input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ramesh Traders"/>
          </Field>
          <Field label="Phone *">
            <input className={inputCls} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value, whatsapp: f.whatsapp || e.target.value })} placeholder="9999999999"/>
          </Field>
          <Field label="WhatsApp">
            <input className={inputCls} value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="Same as phone by default"/>
          </Field>
          <Field label="City / Location">
            <input className={inputCls} value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Mumbai"/>
          </Field>
          <Field label="Address" span>
            <textarea rows={2} className={inputCls} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} placeholder="Shop No. 12, Main Market..." />
          </Field>
          <Field label="GST Number">
            <input className={inputCls} value={f.gstNumber} onChange={e => setF({ ...f, gstNumber: e.target.value.toUpperCase() })}/>
          </Field>
          <Field label="Credit Limit (₹)">
            <input type="number" className={inputCls} value={f.creditLimit} onChange={e => setF({ ...f, creditLimit: Number(e.target.value) || 0 })}/>
          </Field>
          <Field label="Credit Days">
            <input type="number" className={inputCls} value={f.creditDays} onChange={e => setF({ ...f, creditDays: Number(e.target.value) || 7 })}/>
          </Field>
          <Field label="Tags" span>
            <input className={inputCls} value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="wholesale, premium, new"/>
          </Field>
          <Field label="Notes" span>
            <textarea rows={2} className={inputCls} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })}/>
          </Field>
        </div>
        <div className="px-5 py-4 bg-slate-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
          <button
            disabled={!f.name || !f.phone}
            onClick={() => onSave({ ...f, whatsapp: f.whatsapp || f.phone })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14}/> Save Customer
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm';

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

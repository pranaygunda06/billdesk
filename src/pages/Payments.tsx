import { Link } from 'react-router-dom';
import { useState } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import { formatCurrency, formatDate, clsx } from '../lib/utils';
import StatCard from '../components/StatCard';
import { Wallet, Banknote, CircleDollarSign, CreditCard, Search, CircleHelp } from 'lucide-react';

const methodStyle: Record<string, { color: string; label: string; bg: string }> = {
  UPI:       { color: 'text-indigo-700',   bg: 'bg-indigo-50 border-indigo-100',  label: 'UPI' },
  Cash:      { color: 'text-emerald-700',  bg: 'bg-emerald-50 border-emerald-100', label: 'Cash' },
  'Bank Transfer': { color: 'text-sky-700', bg: 'bg-sky-50 border-sky-100', label: 'Bank' },
  Card:      { color: 'text-purple-700',   bg: 'bg-purple-50 border-purple-100', label: 'Card' },
  Cheque:    { color: 'text-amber-700',    bg: 'bg-amber-50 border-amber-100', label: 'Cheque' },
  Pending:   { color: 'text-slate-500',    bg: 'bg-slate-50 border-slate-200',   label: 'Pending' },
};

export default function Payments() {
  useDbTick();
  const [q, setQ] = useState('');
  const payments = db.getPayments();
  const customers = db.getCustomers();
  const invoices = db.getInvoices();

  const total = payments.filter(p => (p.status || '').toLowerCase() !== 'pending').reduce((s, p) => s + p.amount, 0);
  const today = new Date().toDateString();
  const todayAmt = payments.filter(p => new Date(p.paidAt).toDateString() === today && (p.status || '').toLowerCase() !== 'pending').reduce((s, p) => s + p.amount, 0);
  const upiAmt = payments.filter(p => p.method === 'UPI').reduce((s, p) => s + p.amount, 0);
  const cashAmt = payments.filter(p => p.method === 'Cash').reduce((s, p) => s + p.amount, 0);

  const filtered = payments.filter(p => {
    const cust = customers.find(c => c.id === p.customerId);
    const inv = invoices.find(i => i.id === p.invoiceId);
    return [p.method, p.status, cust?.name, inv?.invoiceNumber, p.transactionRef]
      .join(' ').toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Total Collected" value={formatCurrency(total)} icon={Wallet} variant="green" hint={`${payments.length} transactions`}/>
        <StatCard label="Received Today" value={formatCurrency(todayAmt)} icon={Banknote} variant="indigo"/>
        <StatCard label="Via UPI" value={formatCurrency(upiAmt)} icon={CircleDollarSign} variant="teal"/>
        <StatCard label="Cash Received" value={formatCurrency(cashAmt)} icon={CreditCard} variant="amber"/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search by customer, invoice, method, or transaction reference..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-5 py-3 font-bold">Date</th>
                <th className="text-left px-5 py-3 font-bold">Customer</th>
                <th className="text-left px-5 py-3 font-bold">Invoice</th>
                <th className="text-center px-5 py-3 font-bold">Method</th>
                <th className="text-right px-5 py-3 font-bold">Amount</th>
                <th className="text-center px-5 py-3 font-bold">Status</th>
                <th className="text-left px-5 py-3 font-bold">Ref / Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const cust = customers.find(c => c.id === p.customerId);
                const inv = invoices.find(i => i.id === p.invoiceId);
                const style = methodStyle[p.method] || { color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200', label: p.method };
                const pending = (p.status || '').toLowerCase() === 'pending';
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{formatDate(p.paidAt)}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{cust?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{cust?.phone}</div>
                    </td>
                    <td className="px-5 py-3">
                      {inv ? (
                        <Link to={`/invoices/${inv.id}`} className="font-semibold text-brand-700 hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold', style.bg, style.color)}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{formatCurrency(p.amount)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={clsx(
                        'inline-block text-[10px] font-bold uppercase px-2 py-1 rounded-full',
                        pending ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700',
                      )}>
                        {p.status || 'Completed'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-slate-700 font-mono truncate max-w-[200px]">{p.transactionRef || <span className="italic text-slate-400 inline-flex items-center gap-1"><CircleHelp size={12}/> no ref</span>}</div>
                      {p.notes && <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{p.notes}</div>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <Wallet size={34} className="mx-auto text-slate-300 mb-3"/>
                    <div className="text-slate-500 text-sm">No payments recorded yet.</div>
                    <Link to="/reports" className="mt-2 inline-flex text-sm font-semibold text-brand-700 hover:underline">Open an invoice to mark it paid →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

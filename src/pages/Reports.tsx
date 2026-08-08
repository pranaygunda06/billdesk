import { Link } from 'react-router-dom';
import { useState } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import { formatCurrency, formatDate, clsx } from '../lib/utils';
import StatCard from '../components/StatCard';
import { ReceiptText, Wallet, Clock, TrendingUp, FileText, Search } from 'lucide-react';

export default function Reports() {
  useDbTick();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
  const invoices = db.getInvoices();
  const customers = db.getCustomers();

  const totalSales = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalReceived = invoices.reduce((s, i) => s + i.receivedAmount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
  const unpaidCount = invoices.filter(i => i.outstandingAmount > 0).length;

  const filtered = invoices.filter(i => {
    const cust = customers.find(c => c.id === i.customerId);
    const matchQ = [i.invoiceNumber, cust?.name, cust?.phone].join(' ').toLowerCase().includes(q.toLowerCase());
    const unpaid = i.outstandingAmount > 0;
    const matchS = status === 'all' ? true : status === 'paid' ? !unpaid : unpaid;
    return matchQ && matchS;
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard label="Total Sales" value={formatCurrency(totalSales)} icon={TrendingUp} variant="indigo" hint={`${invoices.length} invoices`}/>
        <StatCard label="Amount Received" value={formatCurrency(totalReceived)} icon={Wallet} variant="green"/>
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} icon={Clock} variant="amber" hint={`${unpaidCount} unpaid`}/>
        <StatCard label="Invoices Issued" value={String(invoices.length)} icon={ReceiptText} variant="teal"/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search by invoice number, customer name, phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          {(['all','paid','unpaid'] as const).map(s => (
            <button key={s}
              onClick={() => setStatus(s)}
              className={clsx(
                'px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition',
                status === s ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800',
              )}>
              {s}
            </button>
          ))}
        </div>
        <Link to="/billing" className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-pop text-center justify-center">
          <FileText size={16}/> New Invoice
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-5 py-3 font-bold">#</th>
                <th className="text-left px-5 py-3 font-bold">Customer</th>
                <th className="text-left px-5 py-3 font-bold">Date</th>
                <th className="text-right px-5 py-3 font-bold">Amount</th>
                <th className="text-right px-5 py-3 font-bold">Received</th>
                <th className="text-right px-5 py-3 font-bold">Outstanding</th>
                <th className="text-center px-5 py-3 font-bold">Status</th>
                <th className="text-right px-5 py-3 font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, idx) => {
                const cust = customers.find(c => c.id === inv.customerId);
                const unpaid = inv.outstandingAmount > 0;
                return (
                  <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-semibold text-slate-800">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{inv.invoiceNumber}</div>
                      <div className="text-xs text-slate-500">{cust?.name || '—'}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-5 py-3 text-right text-emerald-700 font-semibold">{formatCurrency(inv.receivedAmount)}</td>
                    <td className={clsx('px-5 py-3 text-right font-semibold', unpaid ? 'text-amber-700' : 'text-slate-400')}>
                      {formatCurrency(inv.outstandingAmount)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={clsx(
                        'inline-block text-[10px] font-bold uppercase px-2.5 py-1 rounded-full',
                        unpaid ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                      )}>
                        {unpaid ? 'Unpaid' : 'Paid'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <FileText size={34} className="mx-auto text-slate-300 mb-3"/>
                    <div className="text-slate-500 text-sm">No invoices to show.</div>
                    <Link to="/billing" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Create your first bill →</Link>
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

import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import StatCard from '../components/StatCard';
import {
  Users,
  Package,
  ReceiptText,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export default function Dashboard() {
  useDbTick();
  const invoices = db.getInvoices();
  const customers = db.getCustomers();
  const products = db.getProducts();
  const payments = db.getPayments();

  const today = new Date().toDateString();
  const todayInvoices = invoices.filter((i) => new Date(i.invoiceDate).toDateString() === today);

  const totalSales = invoices.reduce((s, i) => s + i.grandTotal, 0);
  const todaySales = todayInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);
  const totalCollected = payments.reduce((s, p) => s + (p.status.toLowerCase() === 'completed' || p.status.toLowerCase() === 'paid' ? p.amount : 0), 0);
  const lowStock = products.filter((p) => p.currentStock <= p.minimumStock);

  const recent = useMemo(() => invoices.slice(0, 5), [invoices]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Today's Sales"
          value={formatCurrency(todaySales)}
          icon={ReceiptText}
          variant="indigo"
          hint={`${todayInvoices.length} invoice(s) today`}
          action={<Link to="/billing" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            New Bill <ArrowUpRight size={12}/>
          </Link>}
        />
        <StatCard
          label="Total Collected"
          value={formatCurrency(totalCollected)}
          icon={Wallet}
          variant="green"
          hint={`${payments.length} transactions`}
        />
        <StatCard
          label="Pending Receivables"
          value={formatCurrency(totalOutstanding)}
          icon={Clock}
          variant="amber"
          hint={`${invoices.filter(i => i.outstandingAmount > 0).length} unpaid invoices`}
        />
        <StatCard
          label="Low Stock Alerts"
          value={String(lowStock.length)}
          icon={AlertTriangle}
          variant="rose"
          hint={lowStock.length ? `${lowStock[0].name}${lowStock.length > 1 ? ` +${lowStock.length - 1}` : ''}` : 'All in stock ✓'}
          action={lowStock.length ? <Link to="/products" className="inline-flex text-xs font-semibold text-rose-600 hover:underline">View products</Link> : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">Recent Invoices</h2>
            <Link to="/reports" className="text-xs font-semibold text-brand-700 hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No invoices yet. Create your first bill!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="text-left py-2 font-semibold">Invoice</th>
                    <th className="text-left py-2 font-semibold">Customer</th>
                    <th className="text-right py-2 font-semibold">Amount</th>
                    <th className="text-center py-2 font-semibold">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((inv) => {
                    const cust = customers.find(c => c.id === inv.customerId);
                    const unpaid = inv.outstandingAmount > 0;
                    return (
                      <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="py-2.5 font-semibold text-slate-800">{inv.invoiceNumber}</td>
                        <td className="py-2.5 text-slate-600">{cust?.name || '—'}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                        <td className="py-2.5 text-center">
                          <span className={`inline-block text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                            unpaid ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {unpaid ? 'Unpaid' : 'Paid'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link to={`/invoices/${inv.id}`} className="text-xs font-semibold text-brand-700 hover:underline">Open</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div
            className="rounded-2xl p-5 shadow-card text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#1e1b4b 100%)' }}
          >
            <div className="text-white/70 text-xs font-semibold uppercase tracking-wider">Lifetime Sales</div>
            <div className="mt-1 text-3xl font-extrabold">{formatCurrency(totalSales)}</div>
            <div className="mt-4 flex items-center gap-6 text-sm">
              <div>
                <div className="text-white/60 text-[11px]">Invoices</div>
                <div className="font-bold flex items-center gap-1.5"><ReceiptText size={14}/> {invoices.length}</div>
              </div>
              <div>
                <div className="text-white/60 text-[11px]">Customers</div>
                <div className="font-bold flex items-center gap-1.5"><Users size={14}/> {customers.length}</div>
              </div>
              <div>
                <div className="text-white/60 text-[11px]">Products</div>
                <div className="font-bold flex items-center gap-1.5"><Package size={14}/> {products.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Top Customers</div>
            <div className="mt-3 space-y-2">
              {customers.slice(0, 4).map(c => (
                <Link key={c.id} to="/customers" className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-500">📞 {c.phone}</div>
                    </div>
                  </div>
                  {c.outstandingBalance > 0 ? (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                      {formatCurrency(c.outstandingBalance)}
                    </span>
                  ) : null}
                </Link>
              ))}
              {customers.length === 0 && <div className="text-sm text-slate-400 py-3 text-center">No customers yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

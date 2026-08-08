import { useState } from 'react';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import CameraBarcodeScanner from '../components/CameraBarcodeScanner';
import { clsx, formatCurrency, generateId } from '../lib/utils';
import { Package, Search, Plus, Edit2, Trash2, AlertTriangle, X, Save, Camera } from 'lucide-react';
import type { Product } from '../types';

export default function Products() {
  useDbTick();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const cats = db.getCategories();
  const all = db.getProducts();

  const filtered = all.filter(p =>
    [p.name, p.brand, p.barcode, p.hsnCode].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  function openForm(p?: Product) {
    setEditing(p || empty());
    setOpen(true);
  }

  function save(data: Product) {
    if (all.some(p => p.id === data.id)) db.updateProduct(data);
    else db.addProduct(data);
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
            placeholder="Search by name, brand, barcode, HSN..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"
          />
        </div>
        <button
          onClick={() => openForm()}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg shadow-pop transition"
        >
          <Plus size={16}/> New Product
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left px-5 py-3 font-bold">Product</th>
                <th className="text-left px-5 py-3 font-bold">Brand</th>
                <th className="text-right px-5 py-3 font-bold">Purchase</th>
                <th className="text-right px-5 py-3 font-bold">Selling</th>
                <th className="text-right px-5 py-3 font-bold">MRP</th>
                <th className="text-center px-5 py-3 font-bold">GST</th>
                <th className="text-center px-5 py-3 font-bold">Stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const low = p.currentStock <= p.minimumStock;
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Package size={16}/></div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate max-w-[240px]">{p.name}</div>
                          <div className="text-[11px] text-slate-400">{p.barcode || '—'} · HSN {p.hsnCode || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.brand || '—'}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(p.purchasePrice)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">{formatCurrency(p.sellingPrice)}</td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatCurrency(p.mrp)}</td>
                    <td className="px-5 py-3 text-center"><span className="inline-block text-[10px] font-bold bg-slate-100 px-2 py-1 rounded">{p.gstPercent}%</span></td>
                    <td className="px-5 py-3 text-center">
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold',
                        low ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      )}>
                        {low && <AlertTriangle size={12}/>} {p.currentStock} {p.unit}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openForm(p)} className="w-8 h-8 rounded-md hover:bg-brand-50 text-slate-500 hover:text-brand-700 inline-flex items-center justify-center"><Edit2 size={14}/></button>
                      <button onClick={() => {
                        if (!confirm(`Delete ${p.name}?`)) return;
                        try { db.deleteProduct(p.id); }
                        catch (e: any) { alert(e?.message || 'Cannot delete.'); }
                      }} className="w-8 h-8 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-700 inline-flex items-center justify-center"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-slate-400 text-sm">
                    {q ? 'No matches found.' : 'No products yet. Add your first product to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ProductForm initial={editing!} onClose={() => setOpen(false)} onSave={save} cats={cats} />}
    </div>
  );
}

function empty(): Product {
  const now = new Date().toISOString();
  return {
    id: generateId('prod_'), name: '', categoryId: '', brand: '', barcode: '',
    purchasePrice: 0, sellingPrice: 0, gstPercent: 0, mrp: 0,
    currentStock: 0, minimumStock: 10, unit: 'pcs', hsnCode: '',
    batchNumber: '', expiryDate: '', manufacturer: '', supplierId: '',
    imagePath: '', variants: '', createdAt: now,
  };
}

function ProductForm({ initial, onClose, onSave, cats }: { initial: Product; onClose: () => void; onSave: (p: Product) => void; cats: any[] }) {
  const [f, setF] = useState<Product>(initial);
  const [camOpen, setCamOpen] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between border-b border-slate-100 z-10">
          <div>
            <div className="font-bold text-slate-900">{initial.name ? 'Edit Product' : 'New Product'}</div>
            <div className="text-xs text-slate-500">Inventory, pricing, and GST details</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><X size={18}/></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Product Name *" span>
            <input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Fortune Sunflower Oil 1L"/>
          </Field>
          <Field label="Brand">
            <input className={inp} value={f.brand} onChange={e => setF({ ...f, brand: e.target.value })}/>
          </Field>
          <Field label="Category">
            <select className={inp} value={f.categoryId} onChange={e => setF({ ...f, categoryId: e.target.value })}>
              <option value="">—</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Barcode">
            <div className="flex gap-2">
              <input
                className={inp}
                value={f.barcode}
                onChange={e => setF({ ...f, barcode: e.target.value })}
                placeholder="Type or scan"
                data-barcode="true"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setCamOpen(true)}
                className="shrink-0 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 text-xs font-bold"
                title="Scan with camera"
              >
                <Camera size={16}/> Scan
              </button>
            </div>
          </Field>
          <Field label="HSN Code">
            <input className={inp} value={f.hsnCode} onChange={e => setF({ ...f, hsnCode: e.target.value })}/>
          </Field>
          <Field label="Unit">
            <select className={inp} value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}>
              {['pcs','kg','g','L','ml','m','ft','dozen','box','carton'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>

          <div className="sm:col-span-3 border-t border-slate-100 pt-3 mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pricing</div>
          <Field label="Purchase (₹)">
            <input type="number" className={inp} value={f.purchasePrice} onChange={e => setF({ ...f, purchasePrice: Number(e.target.value) || 0 })}/>
          </Field>
          <Field label="Selling (₹) *">
            <input type="number" className={inp} value={f.sellingPrice} onChange={e => setF({ ...f, sellingPrice: Number(e.target.value) || 0 })}/>
          </Field>
          <Field label="MRP (₹)">
            <input type="number" className={inp} value={f.mrp} onChange={e => setF({ ...f, mrp: Number(e.target.value) || 0 })}/>
          </Field>
          <Field label="GST %">
            <select className={inp} value={f.gstPercent} onChange={e => setF({ ...f, gstPercent: Number(e.target.value) || 0 })}>
              {[0, 0.25, 1.5, 3, 5, 6, 9, 12, 14, 18, 28].map(v => <option key={v} value={v}>{v}%</option>)}
            </select>
          </Field>
          <div className="sm:col-span-3 border-t border-slate-100 pt-3 mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Inventory</div>
          <Field label="Current Stock">
            <input type="number" className={inp} value={f.currentStock} onChange={e => setF({ ...f, currentStock: Number(e.target.value) || 0 })}/>
          </Field>
          <Field label="Min Stock Alert">
            <input type="number" className={inp} value={f.minimumStock} onChange={e => setF({ ...f, minimumStock: Number(e.target.value) || 0 })}/>
          </Field>
          <Field label="Batch Number">
            <input className={inp} value={f.batchNumber} onChange={e => setF({ ...f, batchNumber: e.target.value })}/>
          </Field>
        </div>
        <div className="sticky bottom-0 px-5 py-4 bg-slate-50 flex items-center justify-end gap-2 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
          <button
            disabled={!f.name || f.sellingPrice <= 0}
            onClick={() => onSave(f)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700 disabled:opacity-50"
          >
            <Save size={14}/> Save Product
          </button>
        </div>
      </div>

      <CameraBarcodeScanner
        open={camOpen}
        onClose={() => setCamOpen(false)}
        onScan={(code) => {
          setF((prev) => ({ ...prev, barcode: code }));
          setCamOpen(false);
        }}
        title="Scan product barcode"
      />
    </div>
  );
}

const inp = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm';
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-3' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

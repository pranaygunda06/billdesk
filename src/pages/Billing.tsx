import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import CameraBarcodeScanner from '../components/CameraBarcodeScanner';
import { clsx, formatCurrency, generateId, invoiceNumber } from '../lib/utils';
import type { Customer, Invoice, InvoiceItem, Payment, Product } from '../types';
import {
  User,
  UserPlus,
  Package,
  Plus,
  Minus,
  Trash2,
  ReceiptText,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ScanBarcode,
  Camera,
} from 'lucide-react';

interface CartItem extends InvoiceItem {
  product: Product;
}

export default function Billing() {
  useDbTick();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || '';
  const customers = db.getCustomers();
  const products = db.getProducts();
  const business = db.getBusinessProfile();

  const [customerId, setCustomerId] = useState<string>('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string>('');
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState<string>('');
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [billDiscountType, setBillDiscountType] = useState<'amt' | 'pct'>('amt');
  const [advanced, setAdvanced] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerExpanded, setCustomerExpanded] = useState(true);
  const [productExpanded, setProductExpanded] = useState(true);
  const [notes, setNotes] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);

  // Load invoice into cart when ?edit=invoiceId
  useEffect(() => {
    if (!editId) return;
    const inv = db.getInvoiceById(editId);
    if (!inv) return;
    const items = db.getInvoiceItems(inv.id);
    setEditingInvoiceId(inv.id);
    setEditingInvoiceNumber(inv.invoiceNumber);
    setCustomerId(inv.customerId);
    setNotes(inv.notes || '');
    // Keep discounts on lines; bill-level discount starts at 0 for clean re-edit
    setBillDiscount(0);
    setBillDiscountType('amt');
    const cartItems: CartItem[] = items.map((it) => {
      const prod = db.getProductById(it.productId);
      const gross = it.unitPrice * it.quantity;
      const disc = it.discount || 0;
      const net = Math.max(0, gross - disc);
      const gst = (net * (it.gstPercent ?? 0)) / 100;
      return {
        id: it.id,
        invoiceId: inv.id,
        productId: it.productId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: disc,
        gstPercent: it.gstPercent ?? 0,
        lineTotal: net + gst,
        product: prod,
      };
    });
    setCart(cartItems);
  }, [editId]);

  const customer = customers.find(c => c.id === customerId);
  const filteredCustomers = customers.filter(c =>
    [c.name, c.phone, c.location].join(' ').toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredProducts = products.filter(p =>
    [p.name, p.brand, p.barcode, p.hsnCode].join(' ').toLowerCase().includes(productSearch.toLowerCase())
  );

  const [scanToast, setScanToast] = useState('');

  function addProduct(p: Product) {
    setCart(prev => {
      const found = prev.find(x => x.productId === p.id);
      if (found) {
        return prev.map(x => x.productId === p.id ? recompute({ ...x, quantity: x.quantity + 1 }) : x);
      }
      const newItem: CartItem = {
        id: generateId('it_'),
        invoiceId: '',
        productId: p.id,
        name: p.name,
        quantity: 1,
        unitPrice: p.sellingPrice,
        discount: 0,
        gstPercent: p.gstPercent ?? 0,
        lineTotal: 0,
        product: p,
      };
      return [...prev, recompute(newItem)];
    });
  }

  const handleBarcode = useCallback((code: string) => {
    const found = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === code.trim().toLowerCase(),
    );
    if (found) {
      setCart(prev => {
        const existing = prev.find(x => x.productId === found.id);
        if (existing) {
          return prev.map(x => x.productId === found.id ? recompute({ ...x, quantity: x.quantity + 1 }) : x);
        }
        const newItem: CartItem = {
          id: generateId('it_'),
          invoiceId: '',
          productId: found.id,
          name: found.name,
          quantity: 1,
          unitPrice: found.sellingPrice,
          discount: 0,
          gstPercent: found.gstPercent ?? 0,
          lineTotal: 0,
          product: found,
        };
        return [...prev, recompute(newItem)];
      });
      setProductSearch('');
      setScanToast(`✓ ${found.name} added`);
      setTimeout(() => setScanToast(''), 1500);
    } else {
      setProductSearch(code);
      setScanToast(`No product for barcode: ${code}`);
      setTimeout(() => setScanToast(''), 2000);
    }
  }, [products]);

  useBarcodeScanner(handleBarcode, true);

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(x => x.id === id ? recompute({ ...x, quantity: Math.max(0, x.quantity + delta) }) : x).filter(x => x.quantity > 0));
  }

  function setField(id: string, patch: Partial<CartItem>) {
    setCart(prev => prev.map(x => x.id === id ? recompute({ ...x, ...patch }) : x));
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(x => x.id !== id));
  }

  const { subtotal, itemsDiscount, afterItemDisc, billDiscAmt, taxable, gstTotal, grandTotal } = useMemo(() => {
    const subtotal = cart.reduce((s, x) => s + x.unitPrice * x.quantity, 0);
    const itemsDiscount = cart.reduce((s, x) => s + x.discount, 0);
    const afterItemDisc = subtotal - itemsDiscount;
    const billDiscAmt = billDiscountType === 'pct' ? Math.max(0, (afterItemDisc * billDiscount) / 100) : billDiscount;
    const taxable = Math.max(0, afterItemDisc - billDiscAmt);
    const gstTotal = cart.reduce((s, x) => {
      const taxableLine = Math.max(0, (x.unitPrice * x.quantity - x.discount) - (billDiscAmt > 0 && afterItemDisc > 0 ? ((x.unitPrice * x.quantity - x.discount) / afterItemDisc) * billDiscAmt : 0));
      return s + (taxableLine * x.gstPercent) / 100;
    }, 0);
    return { subtotal, itemsDiscount, afterItemDisc, billDiscAmt, taxable, gstTotal, grandTotal: taxable + gstTotal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, billDiscount, billDiscountType]);

  function recompute(x: CartItem): CartItem {
    const gross = x.unitPrice * x.quantity;
    const discPct = x.discount; // stored as flat amount for simplicity; recompute as % of gross if named 'discountPct' needed
    const net = Math.max(0, gross - discPct);
    const gst = (net * x.gstPercent) / 100;
    return { ...x, lineTotal: net + gst };
  }

  function canGenerate(): boolean {
    return !!customer && cart.length > 0 && grandTotal > 0;
  }

  function generate() {
    if (!canGenerate()) return;
    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + (customer?.creditDays || 7));

    const itemsOut: InvoiceItem[] = cart.map(x => {
      const gross = x.unitPrice * x.quantity;
      const lineShare = afterItemDisc > 0 ? (gross - x.discount) / afterItemDisc : 0;
      const lineBillDisc = lineShare * billDiscAmt;
      return {
        id: x.id || generateId('it_'),
        invoiceId: '',
        productId: x.productId,
        name: x.name,
        quantity: x.quantity,
        unitPrice: x.unitPrice,
        discount: x.discount + lineBillDisc,
        gstPercent: x.gstPercent,
        lineTotal: Math.max(0, (gross - x.discount - lineBillDisc) * (1 + x.gstPercent / 100)),
      };
    });

    if (editingInvoiceId) {
      // UPDATE existing invoice — same number, same short link
      const old = db.getInvoiceById(editingInvoiceId);
      if (!old) return;
      const received = old.receivedAmount || 0;
      const newOutstanding = Math.max(0, grandTotal - received);
      const invoice: Invoice = {
        ...old,
        customerId,
        dueDate: due.toISOString(),
        subtotal,
        discount: itemsDiscount + billDiscAmt,
        gstAmount: gstTotal,
        grandTotal,
        outstandingAmount: newOutstanding,
        status: newOutstanding <= 0 ? 'Paid' : 'Unpaid',
        paymentStatus: newOutstanding <= 0 ? 'Paid' : received > 0 ? 'Partial' : 'Unpaid',
        notes,
        terms: business.terms,
        footer: business.invoiceFooter,
        returnPolicy: business.returnPolicy,
      };
      const itemsWithInv = itemsOut.map((it) => ({ ...it, invoiceId: editingInvoiceId }));
      db.updateInvoice(invoice, itemsWithInv);
      void db.forceCloudPush();
      nav(`/invoices/${editingInvoiceId}`);
      return;
    }

    // CREATE new invoice
    const invId = generateId('inv_');
    const num = `${business.invoicePrefix || 'PS/'}${Date.now().toString().slice(-8)}`;
    const itemsWithInv = itemsOut.map((it) => ({ ...it, invoiceId: invId }));

    const invoice: Invoice = {
      id: invId,
      invoiceNumber: num,
      customerId: customerId,
      invoiceDate: today.toISOString(),
      dueDate: due.toISOString(),
      subtotal,
      discount: itemsDiscount + billDiscAmt,
      gstAmount: gstTotal,
      grandTotal,
      receivedAmount: 0,
      outstandingAmount: grandTotal,
      status: 'Unpaid',
      paymentStatus: 'Unpaid',
      notes,
      terms: business.terms,
      footer: business.invoiceFooter,
      returnPolicy: business.returnPolicy,
      signaturePath: '',
      qrCode: '',
      whatsappTemplate: '',
      printSize: 'A5',
      isDraft: false,
      isHold: false,
      createdAt: today.toISOString(),
    };

    const payment: Payment = {
      id: generateId('pay_'),
      invoiceId: invId,
      customerId: customerId,
      amount: 0,
      method: 'Pending',
      status: 'Pending',
      transactionRef: '',
      paidAt: today.toISOString(),
      notes: '',
      createdAt: today.toISOString(),
    };

    db.addInvoice(invoice, itemsWithInv, payment);
    void db.forceCloudPush();
    nav(`/invoices/${invId}`);
  }

  return (
    <div className="space-y-4">
      {editingInvoiceId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold text-amber-900">
            Editing invoice <span className="font-extrabold">{editingInvoiceNumber}</span>
            <span className="block text-xs font-normal text-amber-700 mt-0.5">
              Same invoice number &amp; short link will update for the customer after you save.
            </span>
          </div>
          <button
            type="button"
            onClick={() => nav(`/invoices/${editingInvoiceId}`)}
            className="text-xs font-bold text-amber-800 underline"
          >
            Cancel edit
          </button>
        </div>
      )}

      {/* POS top bar — camera scan only (no back button) */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2.5 rounded-xl shadow-pop"
        >
          <Camera size={18}/> Scan with Camera
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {/* Customer */}
        <Card open={customerExpanded} toggle={() => setCustomerExpanded(v => !v)}
          icon={User} title="1. Select Customer" subtitle="Pick or add a new customer"
          accent="from-indigo-600 to-indigo-700"
        >
          <div className="p-5">
            {customer ? (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100/40 border border-indigo-100 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold shrink-0">
                    {customer.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{customer.name}</div>
                    <div className="text-xs text-slate-600">📞 {customer.phone} · {customer.location || 'No city'}</div>
                    <div className="text-xs text-slate-500">Credit: ₹{customer.creditLimit.toLocaleString()} · {customer.creditDays}d · O/s {formatCurrency(customer.outstandingBalance)}</div>
                  </div>
                </div>
                <button onClick={() => setCustomerId('')} className="text-xs font-semibold text-rose-600 hover:underline shrink-0">Change</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                  <input
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Search customer by name, phone, or city..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomerId(c.id); setCustomerExpanded(false); setProductExpanded(true); }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/40 transition text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{c.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">📞 {c.phone || 'No phone'}</div>
                      </div>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="col-span-full text-sm text-slate-400 py-4 text-center">No customers match</div>
                  )}
                </div>
                <button
                  onClick={() => setNewCustomerOpen(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
                >
                  <UserPlus size={16}/> Add New Customer
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Products */}
        <Card open={productExpanded} toggle={() => setProductExpanded(v => !v)}
          icon={Package} title="2. Add Products" subtitle={`${cart.length} item(s) in cart`}
          accent="from-emerald-600 to-teal-700"
        >
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                <input
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Search name / brand / barcode..."
                  data-barcode="true"
                  autoComplete="off"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm"
                title="Open camera barcode scanner"
              >
                <ScanBarcode size={18}/>
                <span className="hidden sm:inline">Scan</span>
              </button>
            </div>
            {cart.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold px-3 py-2">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  {advanced && <div className="col-span-1 text-center">Disc</div>}
                  {advanced && <div className="col-span-1 text-center">GST%</div>}
                  <div className={clsx('col-span-1 text-right', advanced ? '' : 'col-span-3')}>
                    <button className="text-slate-400 hover:text-brand-700" onClick={() => setAdvanced(v => !v)}>
                      {advanced ? <Sparkles size={14}/> : <Sparkles size={14} className="opacity-40"/>}
                    </button>
                  </div>
                </div>
                {cart.map(it => (
                  <div key={it.id} className="grid grid-cols-12 items-center gap-1 px-3 py-2.5 border-t border-slate-100 text-sm">
                    <div className="col-span-5 truncate font-semibold text-slate-800" title={it.name}>{it.name}</div>
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      <button onClick={() => updateQty(it.id, -1)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Minus size={12}/></button>
                      <input type="number" value={it.quantity}
                        onChange={e => setField(it.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-12 text-center text-sm font-semibold rounded-md border border-slate-200 py-1"/>
                      <button onClick={() => updateQty(it.id, 1)} className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Plus size={12}/></button>
                    </div>
                    <div className="col-span-2 text-right pr-1">
                      <input type="number" value={it.unitPrice}
                        onChange={e => setField(it.id, { unitPrice: Number(e.target.value) || 0 })}
                        className="w-20 text-right text-sm rounded-md border border-slate-200 py-1 px-2 font-semibold"/>
                    </div>
                    {advanced && (
                      <div className="col-span-1 text-center">
                        <input type="number" value={it.discount}
                          onChange={e => setField(it.id, { discount: Number(e.target.value) || 0 })}
                          title="Item Discount (₹)"
                          className="w-14 text-center text-sm rounded-md border border-slate-200 py-1 px-1"/>
                      </div>
                    )}
                    {advanced && (
                      <div className="col-span-1 text-center">
                        <select value={it.gstPercent}
                          onChange={e => setField(it.id, { gstPercent: Number(e.target.value) || 0 })}
                          className="w-14 text-center text-xs rounded-md border border-slate-200 py-1 px-1 font-bold">
                          {[0, 3, 5, 6, 12, 18, 28].map(v => <option key={v} value={v}>{v}%</option>)}
                        </select>
                      </div>
                    )}
                    <div className={clsx('col-span-1 text-right flex items-center justify-end gap-1.5', advanced ? '' : 'col-span-3')}>
                      <span className="font-extrabold text-slate-900">{formatCurrency(it.lineTotal)}</span>
                      <button onClick={() => removeItem(it.id)} className="w-7 h-7 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredProducts.map(p => {
                const inCart = cart.find(x => x.productId === p.id);
                const low = p.currentStock <= p.minimumStock;
                return (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 transition text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500">{p.brand || 'Generic'} · {formatCurrency(p.sellingPrice)}</div>
                      <div className={clsx('text-[10px] font-bold mt-0.5', low ? 'text-amber-700' : 'text-emerald-700')}>
                        Stock: {p.currentStock} {p.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {inCart && <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">×{inCart.quantity}</span>}
                      <div className="w-7 h-7 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center"><Plus size={14}/></div>
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-sm text-slate-400 py-4 text-center">No products match</div>
              )}
            </div>
          </div>
        </Card>

        {/* Totals / Sticky actions */}
        <div className="sticky bottom-4 z-10">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Items" value={String(cart.length)} />
                <Stat label="Subtotal" value={formatCurrency(subtotal)} />
                <Stat label="Discount" value={formatCurrency(itemsDiscount + billDiscAmt)} negative />
                <Stat label="GST" value={formatCurrency(gstTotal)} />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Grand Total</div>
                  <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(grandTotal)}</div>
                </div>
                <button
                  onClick={generate}
                  disabled={!canGenerate()}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-800 hover:from-brand-700 hover:to-brand-900 text-white font-bold px-6 py-3 rounded-xl shadow-pop disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ReceiptText size={18}/> {editingInvoiceId ? "Update Invoice" : "Generate Bill"}
                </button>
              </div>
            </div>
            {!canGenerate() && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0"/>
                <div>
                  {!customer && 'Select a customer first. '}
                  {cart.length === 0 && 'Add at least one product to the cart. '}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right sidebar: Bill summary + discount + notes */}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-brand-50 to-brand-100/40 border-b border-brand-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-brand-700">Bill Summary</div>
            <div className="font-extrabold text-slate-900 mt-0.5 text-lg">{customer?.name || 'No customer selected'}</div>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <Row label="Subtotal (items)" value={formatCurrency(subtotal)} />
            {itemsDiscount > 0 && <Row label="Item Discounts" value={`- ${formatCurrency(itemsDiscount)}`} negative />}
            <Row label="Bill Discount" value={`- ${formatCurrency(billDiscAmt)}`} negative />
            <div className="border-t border-slate-100 pt-3">
              <Row label="Taxable Amount" value={formatCurrency(taxable)} bold />
              {gstTotal > 0 && <Row label="GST" value={formatCurrency(gstTotal)} />}
            </div>
            <div className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-800 p-4 text-white flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider">Grand Total</div>
              <div className="text-2xl font-extrabold">{formatCurrency(grandTotal)}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className={`py-2 rounded-lg text-xs font-bold border ${billDiscountType === 'amt' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-500'}`}
                onClick={() => setBillDiscountType('amt')}>₹ Amount</button>
              <button className={`py-2 rounded-lg text-xs font-bold border col-span-2 ${billDiscountType === 'pct' ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-500'}`}
                onClick={() => setBillDiscountType('pct')}>% Percent</button>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bill Discount {billDiscountType === 'pct' ? '(%)' : '(₹)'}</label>
              <input type="number" value={billDiscount}
                onChange={e => setBillDiscount(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm font-semibold"/>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Notes / Reference</label>
              <textarea rows={2} value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Order notes, delivery info..."
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm"/>
            </div>
          </div>
        </div>
      </div>

      {newCustomerOpen && <NewCustomerModal onClose={() => setNewCustomerOpen(false)} onCreated={(c) => { setCustomerId(c.id); }}/>}
      </div>

      {scanToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl animate-fadeIn">
          {scanToast}
        </div>
      )}

      <CameraBarcodeScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleBarcode}
        title="Scan product barcode"
      />
    </div>
  );
}

function Row({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={clsx('text-slate-500', bold && 'font-bold text-slate-700')}>{label}</span>
      <span className={clsx('font-semibold', bold && 'font-extrabold text-slate-900', negative ? 'text-rose-600' : 'text-slate-800')}>{value}</span>
    </div>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{label}</div>
      <div className={clsx('font-extrabold', negative ? 'text-rose-600' : 'text-slate-800')}>{value}</div>
    </div>
  );
}

function Card({
  icon: Icon, title, subtitle, accent, open, toggle, children,
}: {
  icon: any; title: string; subtitle: string; accent: string; open: boolean; toggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <button onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/60 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shrink-0`}>
            <Icon size={18}/>
          </div>
          <div>
            <div className="font-bold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
      </button>
      {open && children}
    </div>
  );
}

function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Customer) => void }) {
  const bp = db.getBusinessProfile();
  const [f, setF] = useState<Customer>({
    id: generateId('cust_'), name: '', phone: '', whatsapp: '', address: '', gstNumber: '',
    creditLimit: bp.invoicePrefix && false ? 0 : 0, openingBalance: 0, outstandingBalance: 0, notes: '', location: '', tags: '',
    favorite: false, creditDays: 7, createdAt: new Date().toISOString(),
  });
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-900">Add New Customer</div>
            <div className="text-xs text-slate-500">Quick add — more details later in Customers tab</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><ChevronDown size={18}/></button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name *" span>
            <input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })}/>
          </Field>
          <Field label="Phone *">
            <input className={inp} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value, whatsapp: f.whatsapp || e.target.value })}/>
          </Field>
          <Field label="City">
            <input className={inp} value={f.location} onChange={e => setF({ ...f, location: e.target.value })}/>
          </Field>
          <Field label="Address" span>
            <textarea rows={2} className={inp} value={f.address} onChange={e => setF({ ...f, address: e.target.value })}/>
          </Field>
          <Field label="Credit Days">
            <input type="number" className={inp} value={f.creditDays} onChange={e => setF({ ...f, creditDays: Number(e.target.value) || 7 })}/>
          </Field>
          <Field label="Credit Limit (₹)">
            <input type="number" className={inp} value={f.creditLimit} onChange={e => setF({ ...f, creditLimit: Number(e.target.value) || 0 })}/>
          </Field>
        </div>
        <div className="px-5 py-4 bg-slate-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold text-sm text-slate-600 hover:bg-slate-200">Cancel</button>
          <button
            disabled={!f.name || !f.phone}
            onClick={() => {
              const c: Customer = { ...f, whatsapp: f.whatsapp || f.phone };
              db.addCustomer(c);
              onCreated(c);
              onClose();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-brand-600 to-brand-700 disabled:opacity-40"
          >
            <Plus size={14}/> Add & Select
          </button>
        </div>
      </div>
    </div>
  );
}
const inp = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none text-sm';
function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
// Prevent unused import warning for `invoiceNumber` - it's a valid helper
void invoiceNumber;

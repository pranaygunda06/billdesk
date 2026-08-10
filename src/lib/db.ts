import type { BusinessProfile, Category, Customer, Invoice, InvoiceItem, Payment, Product, ShareShortcut } from '../types';
import { generateId } from './utils';
import {
  saveShareToFirebase,
  fsSet,
  fsDelete,
  fsGetAll,
  fsGet,
} from './firebase';

/**
 * Firestore-first (like ps-enterprises-swart):
 * Memory cache for UI only. Every write goes to Firebase.
 * Login loads from Firebase — same data on every device.
 */

interface DB {
  customers: Customer[];
  products: Product[];
  categories: Category[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
  payments: Payment[];
  share_shortcuts: ShareShortcut[];
  business_profile: BusinessProfile;
}

let _cloudUid: string | null = null;
let _cache: DB = emptyDb();
let _loaded = false;

function emptyDb(): DB {
  const now = new Date().toISOString();
  return {
    business_profile: {
      id: 'business_profile',
      name: 'PS Enterprises',
      address: 'Mumbai, Maharashtra, India',
      phone: '+91 99999 99999',
      gstNumber: '27AAAA0000A1Z5',
      upiId: 'psenterprises@upi',
      invoicePrefix: 'PS/',
      invoiceFooter: 'Thank you for your business. — PS Enterprises',
      terms: 'Goods once sold will not be returned. Payment due within credit period.',
      returnPolicy: 'Returns accepted within 7 days with original bill.',
      signaturePath: '',
      logoPath: '',
      themeMode: 'light',
    },
    categories: [
      { id: 'cat_oil', name: 'Oil', color: '#fb923c', createdAt: now },
      { id: 'cat_grocery', name: 'Grocery', color: '#22c55e', createdAt: now },
      { id: 'cat_snacks', name: 'Snacks', color: '#ec4899', createdAt: now },
    ],
    customers: [],
    products: [],
    invoices: [],
    invoice_items: [],
    payments: [],
    share_shortcuts: [],
  };
}

function shortId(len = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

type Listener = () => void;
const _listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _notify() {
  _listeners.forEach((l) => l());
}

async function reloadFromFirestore(): Promise<void> {
  const [products, customers, invoices, invoice_items, payments, settings] = await Promise.all([
    fsGetAll<Product>('products'),
    fsGetAll<Customer>('customers'),
    fsGetAll<Invoice>('invoices'),
    fsGetAll<InvoiceItem>('invoice_items'),
    fsGetAll<Payment>('payments'),
    fsGet<BusinessProfile>('settings', 'business'),
  ]);

  const base = emptyDb();
  _cache = {
    business_profile: settings || base.business_profile,
    categories: base.categories,
    products: products || [],
    customers: customers || [],
    invoices: invoices || [],
    invoice_items: invoice_items || [],
    payments: payments || [],
    share_shortcuts: _cache.share_shortcuts || [],
  };
  _loaded = true;
  _notify();
}

export const db = {
  resetDb() {
    _cache = emptyDb();
    _notify();
  },

  getBusinessProfile(): BusinessProfile {
    return _cache.business_profile;
  },
  updateBusinessProfile(p: BusinessProfile) {
    _cache.business_profile = p;
    _notify();
    void fsSet('settings', 'business', { ...p });
  },

  getCustomers(): Customer[] {
    return [..._cache.customers].sort((a, b) => a.name.localeCompare(b.name));
  },
  addCustomer(c: Customer) {
    _cache.customers = [..._cache.customers, c];
    _notify();
    void fsSet('customers', c.id, { ...c });
  },
  updateCustomer(c: Customer) {
    _cache.customers = _cache.customers.map((x) => (x.id === c.id ? c : x));
    _notify();
    void fsSet('customers', c.id, { ...c });
  },
  deleteCustomer(id: string) {
    if (_cache.invoices.some((x) => x.customerId === id) || _cache.payments.some((x) => x.customerId === id)) {
      throw new Error('Cannot delete customer with related invoices/payments.');
    }
    _cache.customers = _cache.customers.filter((x) => x.id !== id);
    _notify();
    void fsDelete('customers', id);
  },
  getCustomerById(id: string): Customer {
    const found = _cache.customers.find((x) => x.id === id);
    if (found) return found;
    return {
      id: id || 'deleted',
      name: 'Customer (Deleted)',
      phone: '',
      whatsapp: '',
      address: '',
      gstNumber: '',
      creditLimit: 0,
      openingBalance: 0,
      outstandingBalance: 0,
      notes: '',
      location: '',
      tags: '',
      favorite: false,
      creditDays: 0,
      createdAt: new Date(0).toISOString(),
    };
  },

  getProducts(): Product[] {
    return [..._cache.products].sort((a, b) => a.name.localeCompare(b.name));
  },
  addProduct(p: Product) {
    _cache.products = [..._cache.products, p];
    _notify();
    void fsSet('products', p.id, { ...p });
  },
  updateProduct(p: Product) {
    _cache.products = _cache.products.map((x) => (x.id === p.id ? p : x));
    _notify();
    void fsSet('products', p.id, { ...p });
  },
  deleteProduct(id: string) {
    if (_cache.invoice_items.some((x) => x.productId === id)) {
      throw new Error('Cannot delete product used in invoices.');
    }
    _cache.products = _cache.products.filter((x) => x.id !== id);
    _notify();
    void fsDelete('products', id);
  },
  getProductById(id: string): Product {
    const found = _cache.products.find((x) => x.id === id);
    if (found) return found;
    return {
      id: id || 'deleted',
      name: 'Product (Deleted)',
      categoryId: '',
      brand: '',
      barcode: '',
      purchasePrice: 0,
      sellingPrice: 0,
      gstPercent: 0,
      mrp: 0,
      currentStock: 0,
      minimumStock: 0,
      unit: 'pcs',
      hsnCode: '',
      batchNumber: '',
      expiryDate: '',
      manufacturer: '',
      supplierId: '',
      imagePath: '',
      variants: '',
      createdAt: new Date(0).toISOString(),
    };
  },

  getInvoices(): Invoice[] {
    return [..._cache.invoices].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
  getInvoiceById(id: string): Invoice | undefined {
    return _cache.invoices.find((x) => x.id === id);
  },
  addInvoice(inv: Invoice, items: InvoiceItem[], payment: Payment) {
    _cache.invoices = [..._cache.invoices, inv];
    _cache.invoice_items = [..._cache.invoice_items, ...items];
    _cache.payments = [..._cache.payments, payment];
    if (inv.customerId) {
      _cache.customers = _cache.customers.map((c) =>
        c.id === inv.customerId
          ? { ...c, outstandingBalance: Math.max(0, c.outstandingBalance + inv.outstandingAmount) }
          : c,
      );
    }
    _notify();
    void fsSet('invoices', inv.id, { ...inv });
    for (const it of items) void fsSet('invoice_items', it.id, { ...it });
    void fsSet('payments', payment.id, { ...payment });
  },
  updateInvoice(inv: Invoice, items: InvoiceItem[]) {
    const old = _cache.invoices.find((x) => x.id === inv.id);
    if (!old) throw new Error('Invoice not found');
    if (old.customerId) {
      _cache.customers = _cache.customers.map((c) => {
        if (c.id !== old.customerId) return c;
        return {
          ...c,
          outstandingBalance: Math.max(
            0,
            c.outstandingBalance - (old.outstandingAmount || 0) + (inv.outstandingAmount || 0),
          ),
        };
      });
    }
    const next = { ...inv, id: old.id, invoiceNumber: old.invoiceNumber, createdAt: old.createdAt };
    _cache.invoices = _cache.invoices.map((x) => (x.id === inv.id ? next : x));
    const removed = _cache.invoice_items.filter((x) => x.invoiceId === inv.id);
    _cache.invoice_items = _cache.invoice_items.filter((x) => x.invoiceId !== inv.id).concat(items);
    _notify();
    void fsSet('invoices', inv.id, { ...next });
    for (const r of removed) void fsDelete('invoice_items', r.id);
    for (const it of items) void fsSet('invoice_items', it.id, { ...it });
  },
  getInvoiceItems(invoiceId: string): InvoiceItem[] {
    return _cache.invoice_items.filter((x) => x.invoiceId === invoiceId);
  },
  markInvoicePaid(invoiceId: string) {
    const inv = _cache.invoices.find((x) => x.id === invoiceId);
    if (!inv) return;
    const amount = inv.outstandingAmount;
    const updated: Invoice = {
      ...inv,
      receivedAmount: inv.grandTotal,
      outstandingAmount: 0,
      paymentStatus: 'Paid',
      status: 'Paid',
    };
    const payment: Payment = {
      id: generateId('pay_'),
      invoiceId: inv.id,
      customerId: inv.customerId,
      amount,
      method: 'UPI',
      status: 'Completed',
      transactionRef: `manual_${Date.now()}`,
      paidAt: new Date().toISOString(),
      notes: 'Marked as paid manually',
      createdAt: new Date().toISOString(),
    };
    _cache.invoices = _cache.invoices.map((x) => (x.id === invoiceId ? updated : x));
    _cache.payments = [..._cache.payments, payment];
    if (inv.customerId && amount > 0) {
      _cache.customers = _cache.customers.map((c) =>
        c.id === inv.customerId
          ? { ...c, outstandingBalance: Math.max(0, c.outstandingBalance - amount) }
          : c,
      );
    }
    _notify();
    void fsSet('invoices', updated.id, { ...updated });
    void fsSet('payments', payment.id, { ...payment });
  },
  getPayments(): Payment[] {
    return [..._cache.payments].sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  },
  getCategories(): Category[] {
    return _cache.categories;
  },

  getOrCreateShareShortcut(args: { invoiceId: string; token: string }): ShareShortcut {
    const existing = _cache.share_shortcuts.find((s) => s.invoiceId === args.invoiceId);
    if (existing) {
      existing.token = args.token;
      _notify();
      void saveShareToFirebase(existing.shortId, {
        invoiceId: existing.invoiceId,
        token: args.token,
      });
      return existing;
    }
    let sid = shortId(8);
    while (_cache.share_shortcuts.some((s) => s.shortId === sid)) sid = shortId(8);
    const sc: ShareShortcut = {
      id: generateId('sh_'),
      shortId: sid,
      invoiceId: args.invoiceId,
      token: args.token,
      createdAt: new Date().toISOString(),
    };
    _cache.share_shortcuts = [..._cache.share_shortcuts, sc];
    _notify();
    void saveShareToFirebase(sid, { invoiceId: args.invoiceId, token: args.token });
    return sc;
  },

  async publishShareToCloud(shortId: string, invoiceId: string, token: string): Promise<boolean> {
    return saveShareToFirebase(shortId, { invoiceId, token });
  },

  async bindCloudUser(uid: string): Promise<{ fromCloud: boolean; pushed: boolean }> {
    _cloudUid = uid;
    try {
      await reloadFromFirestore();
      const hasData =
        _cache.products.length > 0 ||
        _cache.customers.length > 0 ||
        _cache.invoices.length > 0;
      await fsSet('settings', 'business', { ..._cache.business_profile });
      return { fromCloud: hasData, pushed: true };
    } catch (e) {
      console.error('bindCloudUser failed', e);
      return { fromCloud: false, pushed: false };
    }
  },

  clearCloudUser() {
    _cloudUid = null;
  },

  async forceCloudPush(): Promise<boolean> {
    let ok = 0;
    if (await fsSet('settings', 'business', { ..._cache.business_profile })) ok++;
    for (const p of _cache.products) if (await fsSet('products', p.id, { ...p })) ok++;
    for (const c of _cache.customers) if (await fsSet('customers', c.id, { ...c })) ok++;
    for (const inv of _cache.invoices) if (await fsSet('invoices', inv.id, { ...inv })) ok++;
    for (const it of _cache.invoice_items) if (await fsSet('invoice_items', it.id, { ...it })) ok++;
    for (const pay of _cache.payments) if (await fsSet('payments', pay.id, { ...pay })) ok++;
    return ok > 0;
  },

  getCloudUid() {
    return _cloudUid;
  },

  isLoaded() {
    return _loaded;
  },

  getShareByShortId(shortId: string): ShareShortcut | undefined {
    return _cache.share_shortcuts.find((s) => s.shortId === shortId);
  },

  getAllShareShortcuts(): ShareShortcut[] {
    return [..._cache.share_shortcuts].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
};

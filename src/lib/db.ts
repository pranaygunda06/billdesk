import type { BusinessProfile, Category, Customer, Invoice, InvoiceItem, Payment, Product, ShareShortcut } from '../types';
import { generateId } from './utils';
import {
  saveShareToFirebase,
  getShareFromFirebase,
  fsSet,
  fsDelete,
  fsGetAll,
  fsGet,
  getLastFirebaseError,
} from './firebase';

/**
 * Firestore-first with localStorage mirror:
 * - Every write goes to Firebase AND localStorage
 * - On login/refresh: load Firestore, fall back to local mirror if cloud empty/fails
 * - Share shortcuts always published to Firebase so short links work on any device
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

const LS_KEY = 'ps_billdesk_db_v1';

let _cloudUid: string | null = null;
let _cache: DB = emptyDb();
let _loaded = false;
let _lastWriteError = '';

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

function mirrorToLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_cache));
  } catch (e) {
    console.warn('localStorage mirror failed', e);
  }
}

function loadLocalMirror(): DB | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DB;
    if (!parsed || typeof parsed !== 'object') return null;
    // Basic shape check
    if (!Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
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

async function writeDoc(col: string, id: string, data: Record<string, unknown>): Promise<boolean> {
  const ok = await fsSet(col, id, data);
  if (!ok) {
    _lastWriteError = getLastFirebaseError() || `Failed to save ${col}/${id}`;
    console.error(_lastWriteError);
  } else {
    _lastWriteError = '';
  }
  return ok;
}

async function reloadFromFirestore(): Promise<boolean> {
  try {
    const [products, customers, invoices, invoice_items, payments, settings, shares] = await Promise.all([
      fsGetAll<Product>('products'),
      fsGetAll<Customer>('customers'),
      fsGetAll<Invoice>('invoices'),
      fsGetAll<InvoiceItem>('invoice_items'),
      fsGetAll<Payment>('payments'),
      fsGet<BusinessProfile>('settings', 'business'),
      fsGetAll<ShareShortcut & { id: string }>('shares'),
    ]);

    const base = emptyDb();
    const share_shortcuts: ShareShortcut[] = (shares || []).map((s: any) => ({
      id: s.id || generateId('sh_'),
      shortId: s.id || s.shortId,
      invoiceId: s.invoiceId || '',
      token: s.token || '',
      createdAt: s.createdAt || new Date().toISOString(),
    })).filter((s) => s.token && s.shortId);

    const cloudHasData =
      (products && products.length > 0) ||
      (customers && customers.length > 0) ||
      (invoices && invoices.length > 0);

    if (cloudHasData || settings) {
      _cache = {
        business_profile: settings || base.business_profile,
        categories: base.categories,
        products: products || [],
        customers: customers || [],
        invoices: invoices || [],
        invoice_items: invoice_items || [],
        payments: payments || [],
        share_shortcuts,
      };
      mirrorToLocal();
      _loaded = true;
      _notify();
      return true;
    }

    // Cloud empty — try local mirror so refresh doesn't wipe data
    const local = loadLocalMirror();
    if (local) {
      _cache = {
        ...base,
        ...local,
        categories: local.categories?.length ? local.categories : base.categories,
        business_profile: local.business_profile || base.business_profile,
        share_shortcuts: share_shortcuts.length ? share_shortcuts : (local.share_shortcuts || []),
      };
      _loaded = true;
      _notify();
      // Push local data up so cloud catches up
      void db.forceCloudPush();
      return true;
    }

    _cache = base;
    _loaded = true;
    _notify();
    return true;
  } catch (e) {
    console.error('reloadFromFirestore failed', e);
    const local = loadLocalMirror();
    if (local) {
      const base = emptyDb();
      _cache = {
        ...base,
        ...local,
        categories: local.categories?.length ? local.categories : base.categories,
        business_profile: local.business_profile || base.business_profile,
      };
      _loaded = true;
      _notify();
      return true;
    }
    return false;
  }
}

export const db = {
  resetDb() {
    _cache = emptyDb();
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    _notify();
  },

  getLastWriteError() {
    return _lastWriteError;
  },

  getBusinessProfile(): BusinessProfile {
    return _cache.business_profile;
  },
  updateBusinessProfile(p: BusinessProfile) {
    _cache.business_profile = p;
    mirrorToLocal();
    _notify();
    void writeDoc('settings', 'business', { ...p });
  },

  getCustomers(): Customer[] {
    return [..._cache.customers].sort((a, b) => a.name.localeCompare(b.name));
  },
  addCustomer(c: Customer) {
    _cache.customers = [..._cache.customers, c];
    mirrorToLocal();
    _notify();
    void writeDoc('customers', c.id, { ...c });
  },
  updateCustomer(c: Customer) {
    _cache.customers = _cache.customers.map((x) => (x.id === c.id ? c : x));
    mirrorToLocal();
    _notify();
    void writeDoc('customers', c.id, { ...c });
  },
  deleteCustomer(id: string) {
    if (_cache.invoices.some((x) => x.customerId === id) || _cache.payments.some((x) => x.customerId === id)) {
      throw new Error('Cannot delete customer with related invoices/payments.');
    }
    _cache.customers = _cache.customers.filter((x) => x.id !== id);
    mirrorToLocal();
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
    mirrorToLocal();
    _notify();
    void writeDoc('products', p.id, { ...p });
  },
  updateProduct(p: Product) {
    _cache.products = _cache.products.map((x) => (x.id === p.id ? p : x));
    mirrorToLocal();
    _notify();
    void writeDoc('products', p.id, { ...p });
  },
  deleteProduct(id: string) {
    if (_cache.invoice_items.some((x) => x.productId === id)) {
      throw new Error('Cannot delete product used in invoices.');
    }
    _cache.products = _cache.products.filter((x) => x.id !== id);
    mirrorToLocal();
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
    mirrorToLocal();
    _notify();
    void writeDoc('invoices', inv.id, { ...inv });
    for (const it of items) void writeDoc('invoice_items', it.id, { ...it });
    void writeDoc('payments', payment.id, { ...payment });
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
    mirrorToLocal();
    _notify();
    void writeDoc('invoices', inv.id, { ...next });
    for (const r of removed) void fsDelete('invoice_items', r.id);
    for (const it of items) void writeDoc('invoice_items', it.id, { ...it });
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
    mirrorToLocal();
    _notify();
    void writeDoc('invoices', updated.id, { ...updated });
    void writeDoc('payments', payment.id, { ...payment });
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
      mirrorToLocal();
      _notify();
      // Always re-publish so other devices can resolve
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
    mirrorToLocal();
    _notify();
    void saveShareToFirebase(sid, { invoiceId: args.invoiceId, token: args.token });
    return sc;
  },

  async publishShareToCloud(shortId: string, invoiceId: string, token: string): Promise<boolean> {
    const ok = await saveShareToFirebase(shortId, { invoiceId, token });
    if (ok) {
      // Keep local cache in sync
      const existing = _cache.share_shortcuts.find((s) => s.shortId === shortId);
      if (existing) {
        existing.token = token;
        existing.invoiceId = invoiceId;
      } else {
        _cache.share_shortcuts = [
          ..._cache.share_shortcuts,
          {
            id: generateId('sh_'),
            shortId,
            invoiceId,
            token,
            createdAt: new Date().toISOString(),
          },
        ];
      }
      mirrorToLocal();
    }
    return ok;
  },

  async resolveShareToken(shortId: string): Promise<string | null> {
    // 1. Local cache
    const local = _cache.share_shortcuts.find((s) => s.shortId === shortId);
    if (local?.token) return local.token;

    // 2. localStorage mirror
    const mirror = loadLocalMirror();
    const fromMirror = mirror?.share_shortcuts?.find((s) => s.shortId === shortId);
    if (fromMirror?.token) return fromMirror.token;

    // 3. Firebase (works on any device)
    const remote = await getShareFromFirebase(shortId);
    if (remote?.token) {
      // Cache locally for next time
      _cache.share_shortcuts = [
        ..._cache.share_shortcuts.filter((s) => s.shortId !== shortId),
        {
          id: generateId('sh_'),
          shortId,
          invoiceId: remote.invoiceId || '',
          token: remote.token,
          createdAt: new Date().toISOString(),
        },
      ];
      mirrorToLocal();
      return remote.token;
    }
    return null;
  },

  async bindCloudUser(uid: string): Promise<{ fromCloud: boolean; pushed: boolean }> {
    _cloudUid = uid;

    // Seed from local mirror immediately so UI isn't empty while cloud loads
    const local = loadLocalMirror();
    if (local && !_loaded) {
      const base = emptyDb();
      _cache = {
        ...base,
        ...local,
        categories: local.categories?.length ? local.categories : base.categories,
        business_profile: local.business_profile || base.business_profile,
      };
      _notify();
    }

    try {
      await reloadFromFirestore();
      const hasData =
        _cache.products.length > 0 ||
        _cache.customers.length > 0 ||
        _cache.invoices.length > 0;
      await writeDoc('settings', 'business', { ..._cache.business_profile });
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
    if (await writeDoc('settings', 'business', { ..._cache.business_profile })) ok++;
    for (const p of _cache.products) if (await writeDoc('products', p.id, { ...p })) ok++;
    for (const c of _cache.customers) if (await writeDoc('customers', c.id, { ...c })) ok++;
    for (const inv of _cache.invoices) if (await writeDoc('invoices', inv.id, { ...inv })) ok++;
    for (const it of _cache.invoice_items) if (await writeDoc('invoice_items', it.id, { ...it })) ok++;
    for (const pay of _cache.payments) if (await writeDoc('payments', pay.id, { ...pay })) ok++;
    for (const sh of _cache.share_shortcuts) {
      if (await saveShareToFirebase(sh.shortId, { invoiceId: sh.invoiceId, token: sh.token })) ok++;
    }
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

import type { BusinessProfile, Category, Customer, Invoice, InvoiceItem, Payment, Product, ShareShortcut } from '../types';
import { generateId } from './utils';
import {
  saveShareToFirebase,
  fsSet,
  fsDelete,
  fsGetAll,
  fsGet,
} from './firebase';

const KEY = 'ps_enterprise_web_db_v3';

/** Logged-in UID — enables cloud writes */
let _cloudUid: string | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

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

function shortId(len = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function defaults(): DB {
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

function read(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const init = defaults();
      localStorage.setItem(KEY, JSON.stringify(init));
      return init;
    }
    const parsed = JSON.parse(raw) as DB;
    if (!Array.isArray(parsed.share_shortcuts)) parsed.share_shortcuts = [];
    if (!Array.isArray(parsed.products)) parsed.products = [];
    if (!Array.isArray(parsed.customers)) parsed.customers = [];
    if (!Array.isArray(parsed.invoices)) parsed.invoices = [];
    if (!Array.isArray(parsed.invoice_items)) parsed.invoice_items = [];
    if (!Array.isArray(parsed.payments)) parsed.payments = [];
    return parsed;
  } catch {
    const init = defaults();
    localStorage.setItem(KEY, JSON.stringify(init));
    return init;
  }
}

function write(dbData: DB) {
  localStorage.setItem(KEY, JSON.stringify(dbData));
  _notify();
}

async function pushAllToFirestore(d: DB): Promise<boolean> {
  if (!_cloudUid) return false;
  const jobs: Promise<boolean>[] = [];
  jobs.push(fsSet('settings', 'business', d.business_profile as unknown as Record<string, unknown>));
  for (const p of d.products) jobs.push(fsSet('products', p.id, { ...p }));
  for (const c of d.customers) jobs.push(fsSet('customers', c.id, { ...c }));
  for (const inv of d.invoices) jobs.push(fsSet('invoices', inv.id, { ...inv }));
  for (const it of d.invoice_items) jobs.push(fsSet('invoice_items', it.id, { ...it }));
  for (const pay of d.payments) jobs.push(fsSet('payments', pay.id, { ...pay }));
  for (const cat of d.categories) jobs.push(fsSet('categories', cat.id, { ...cat }));
  const results = await Promise.all(jobs);
  return results.every(Boolean);
}

async function pullAllFromFirestore(): Promise<DB | null> {
  const [products, customers, invoices, invoice_items, payments, categories, settings] =
    await Promise.all([
      fsGetAll<Product>('products'),
      fsGetAll<Customer>('customers'),
      fsGetAll<Invoice>('invoices'),
      fsGetAll<InvoiceItem>('invoice_items'),
      fsGetAll<Payment>('payments'),
      fsGetAll<Category>('categories'),
      fsGet<BusinessProfile>('settings', 'business'),
    ]);
  if (products.length === 0 && customers.length === 0 && invoices.length === 0 && !settings) {
    return null;
  }
  const base = defaults();
  return {
    business_profile: settings || base.business_profile,
    categories: categories.length ? categories : base.categories,
    products,
    customers,
    invoices,
    invoice_items,
    payments,
    share_shortcuts: read().share_shortcuts || [],
  };
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

export const db = {
  resetDb() {
    localStorage.removeItem(KEY);
    read();
    _notify();
  },
  getBusinessProfile(): BusinessProfile {
    return read().business_profile;
  },
  updateBusinessProfile(p: BusinessProfile) {
    const d = read();
    d.business_profile = p;
    write(d);
    if (_cloudUid) void fsSet('settings', 'business', { ...p });
  },
  getCustomers(): Customer[] {
    return read().customers.sort((a, b) => a.name.localeCompare(b.name));
  },
  addCustomer(c: Customer) {
    const d = read();
    d.customers.push(c);
    write(d);
    if (_cloudUid) void fsSet('customers', c.id, { ...c });
  },
  updateCustomer(c: Customer) {
    const d = read();
    const i = d.customers.findIndex((x) => x.id === c.id);
    if (i >= 0) d.customers[i] = c;
    write(d);
    if (_cloudUid) void fsSet('customers', c.id, { ...c });
  },
  deleteCustomer(id: string) {
    const d = read();
    if (d.invoices.some((x) => x.customerId === id) || d.payments.some((x) => x.customerId === id)) {
      throw new Error('Cannot delete customer with related invoices/payments.');
    }
    d.customers = d.customers.filter((x) => x.id !== id);
    write(d);
    if (_cloudUid) void fsDelete('customers', id);
  },
  getCustomerById(id: string): Customer {
    const found = read().customers.find((x) => x.id === id);
    if (found) return found;
    return {
      id: id || 'deleted', name: 'Customer (Deleted)', phone: '', whatsapp: '', address: '',
      gstNumber: '', creditLimit: 0, openingBalance: 0, outstandingBalance: 0, notes: '',
      location: '', tags: '', favorite: false, creditDays: 0, createdAt: new Date(0).toISOString(),
    };
  },
  getProducts(): Product[] {
    return read().products.sort((a, b) => a.name.localeCompare(b.name));
  },
  addProduct(p: Product) {
    const d = read();
    d.products.push(p);
    write(d);
    if (_cloudUid) void fsSet('products', p.id, { ...p });
  },
  updateProduct(p: Product) {
    const d = read();
    const i = d.products.findIndex((x) => x.id === p.id);
    if (i >= 0) d.products[i] = p;
    write(d);
    if (_cloudUid) void fsSet('products', p.id, { ...p });
  },
  deleteProduct(id: string) {
    const d = read();
    if (d.invoice_items.some((x) => x.productId === id)) {
      throw new Error('Cannot delete product used in invoices.');
    }
    d.products = d.products.filter((x) => x.id !== id);
    write(d);
    if (_cloudUid) void fsDelete('products', id);
  },
  getProductById(id: string): Product {
    const found = read().products.find((x) => x.id === id);
    if (found) return found;
    return {
      id: id || 'deleted', name: 'Product (Deleted)', categoryId: '', brand: '', barcode: '',
      purchasePrice: 0, sellingPrice: 0, gstPercent: 0, mrp: 0, currentStock: 0, minimumStock: 0,
      unit: 'pcs', hsnCode: '', batchNumber: '', expiryDate: '', manufacturer: '', supplierId: '',
      imagePath: '', variants: '', createdAt: new Date(0).toISOString(),
    };
  },
  getInvoices(): Invoice[] {
    return read().invoices.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
  getInvoiceById(id: string): Invoice | undefined {
    return read().invoices.find((x) => x.id === id);
  },
  addInvoice(inv: Invoice, items: InvoiceItem[], payment: Payment) {
    const d = read();
    d.invoices.push(inv);
    d.invoice_items.push(...items);
    d.payments.push(payment);
    if (inv.customerId) {
      const c = d.customers.find((x) => x.id === inv.customerId);
      if (c) c.outstandingBalance = Math.max(0, c.outstandingBalance + inv.outstandingAmount);
    }
    write(d);
    if (_cloudUid) {
      void fsSet('invoices', inv.id, { ...inv });
      for (const it of items) void fsSet('invoice_items', it.id, { ...it });
      void fsSet('payments', payment.id, { ...payment });
      if (inv.customerId) {
        const c = d.customers.find((x) => x.id === inv.customerId);
        if (c) void fsSet('customers', c.id, { ...c });
      }
    }
  },
  updateInvoice(inv: Invoice, items: InvoiceItem[]) {
    const d = read();
    const idx = d.invoices.findIndex((x) => x.id === inv.id);
    if (idx < 0) throw new Error('Invoice not found');
    const old = d.invoices[idx];
    if (old.customerId) {
      const c = d.customers.find((x) => x.id === old.customerId);
      if (c) {
        c.outstandingBalance = Math.max(
          0,
          c.outstandingBalance - (old.outstandingAmount || 0) + (inv.outstandingAmount || 0),
        );
      }
    }
    d.invoices[idx] = { ...inv, id: old.id, invoiceNumber: old.invoiceNumber, createdAt: old.createdAt };
    const removed = d.invoice_items.filter((x) => x.invoiceId === inv.id);
    d.invoice_items = d.invoice_items.filter((x) => x.invoiceId !== inv.id).concat(items);
    write(d);
    if (_cloudUid) {
      void fsSet('invoices', inv.id, { ...d.invoices[idx] });
      for (const r of removed) void fsDelete('invoice_items', r.id);
      for (const it of items) void fsSet('invoice_items', it.id, { ...it });
    }
  },
  getInvoiceItems(invoiceId: string): InvoiceItem[] {
    return read().invoice_items.filter((x) => x.invoiceId === invoiceId);
  },
  markInvoicePaid(invoiceId: string) {
    const d = read();
    const inv = d.invoices.find((x) => x.id === invoiceId);
    if (!inv) return;
    const amount = inv.outstandingAmount;
    inv.receivedAmount = inv.grandTotal;
    inv.outstandingAmount = 0;
    inv.paymentStatus = 'Paid';
    inv.status = 'Paid';
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
    d.payments.push(payment);
    if (inv.customerId && amount > 0) {
      const c = d.customers.find((x) => x.id === inv.customerId);
      if (c) c.outstandingBalance = Math.max(0, c.outstandingBalance - amount);
    }
    write(d);
    if (_cloudUid) {
      void fsSet('invoices', inv.id, { ...inv });
      void fsSet('payments', payment.id, { ...payment });
    }
  },
  getPayments(): Payment[] {
    return read().payments.sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  },
  getCategories(): Category[] {
    return read().categories;
  },
  getOrCreateShareShortcut(args: { invoiceId: string; token: string }): ShareShortcut {
    const d = read();
    const existing = d.share_shortcuts.find((s) => s.invoiceId === args.invoiceId);
    if (existing) {
      existing.token = args.token;
      write(d);
      void saveShareToFirebase(existing.shortId, { invoiceId: existing.invoiceId, token: args.token });
      return existing;
    }
    let sid = shortId(8);
    while (d.share_shortcuts.some((s) => s.shortId === sid)) sid = shortId(8);
    const sc: ShareShortcut = {
      id: generateId('sh_'),
      shortId: sid,
      invoiceId: args.invoiceId,
      token: args.token,
      createdAt: new Date().toISOString(),
    };
    d.share_shortcuts.push(sc);
    write(d);
    void saveShareToFirebase(sid, { invoiceId: args.invoiceId, token: args.token });
    return sc;
  },
  async publishShareToCloud(shortId: string, invoiceId: string, token: string): Promise<boolean> {
    return saveShareToFirebase(shortId, { invoiceId, token });
  },
  async bindCloudUser(uid: string): Promise<{ fromCloud: boolean; pushed: boolean }> {
    _cloudUid = uid;
    try {
      const remote = await pullAllFromFirestore();
      if (remote) {
        localStorage.setItem(KEY, JSON.stringify(remote));
        _notify();
        return { fromCloud: true, pushed: false };
      }
      const local = read();
      const ok = await pushAllToFirestore(local);
      return { fromCloud: false, pushed: ok };
    } catch (e) {
      console.error('bindCloudUser failed', e);
      return { fromCloud: false, pushed: false };
    }
  },
  clearCloudUser() {
    _cloudUid = null;
  },
  async forceCloudPush(): Promise<boolean> {
    if (!_cloudUid) return false;
    return pushAllToFirestore(read());
  },
  getCloudUid() {
    return _cloudUid;
  },
  getShareByShortId(shortId: string): ShareShortcut | undefined {
    const d = read();
    const found = d.share_shortcuts.find((s) => s.shortId === shortId);
    if (found) {
      found.accessedAt = new Date().toISOString();
      write(d);
    }
    return found;
  },
  getAllShareShortcuts(): ShareShortcut[] {
    return read().share_shortcuts.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },
};

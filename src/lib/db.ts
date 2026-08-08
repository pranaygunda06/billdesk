import type { BusinessProfile, Category, Customer, Invoice, InvoiceItem, Payment, Product, ShareShortcut } from '../types';
import { generateId } from './utils';
import {
  saveShareToFirebase,
  saveUserDataToCloud,
  loadUserDataFromCloud,
} from './firebase';

const KEY = 'ps_enterprise_web_db_v2'; // v2: default GST 0 on all seed products

/** Currently logged-in Firebase UID — used for multi-device cloud sync */
let _cloudUid: string | null = null;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _syncing = false;

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
    customers: [
      {
        id: 'cust_1', name: 'Ramesh Traders', phone: '9999999999', whatsapp: '9999999999',
        address: 'Andheri, Mumbai', gstNumber: '27AAAA0000A1Z5',
        creditLimit: 50000, openingBalance: 0, outstandingBalance: 7500,
        notes: 'Premium wholesale client', location: 'Mumbai', tags: 'wholesale',
        favorite: true, creditDays: 30, createdAt: now,
      },
      {
        id: 'cust_2', name: 'Suresh Kirana', phone: '9888888888', whatsapp: '9888888888',
        address: 'Dadar, Mumbai', gstNumber: '',
        creditLimit: 20000, openingBalance: 0, outstandingBalance: 0,
        notes: '', location: 'Mumbai', tags: 'retail',
        favorite: false, creditDays: 7, createdAt: now,
      },
    ],
    products: [
      {
        id: 'prod_1', name: 'Fortune Sunflower Oil 1L', categoryId: 'cat_oil', brand: 'Fortune',
        barcode: '8901234567890', purchasePrice: 130, sellingPrice: 145, gstPercent: 0, mrp: 165,
        currentStock: 80, minimumStock: 20, unit: 'L', hsnCode: '1512',
        batchNumber: 'B001', expiryDate: '2027-12-31', manufacturer: 'Adani Wilmar',
        supplierId: '', imagePath: '', variants: '1L', createdAt: now,
      },
      {
        id: 'prod_2', name: 'Fortune Sunflower Oil 5L', categoryId: 'cat_oil', brand: 'Fortune',
        barcode: '8901234567891', purchasePrice: 630, sellingPrice: 700, gstPercent: 0, mrp: 799,
        currentStock: 36, minimumStock: 10, unit: 'L', hsnCode: '1512',
        batchNumber: 'B001', expiryDate: '2027-12-31', manufacturer: 'Adani Wilmar',
        supplierId: '', imagePath: '', variants: '5L', createdAt: now,
      },
      {
        id: 'prod_3', name: 'Tata Sampann Toor Dal 1kg', categoryId: 'cat_grocery', brand: 'Tata',
        barcode: '8901234567800', purchasePrice: 130, sellingPrice: 148, gstPercent: 0, mrp: 175,
        currentStock: 120, minimumStock: 30, unit: 'kg', hsnCode: '0713',
        batchNumber: 'T01', expiryDate: '2026-12-31', manufacturer: 'Tata',
        supplierId: '', imagePath: '', variants: '1kg', createdAt: now,
      },
      {
        id: 'prod_4', name: 'Aashirvaad Wheat Flour 10kg', categoryId: 'cat_grocery', brand: 'Aashirvaad',
        barcode: '8901234567900', purchasePrice: 360, sellingPrice: 395, gstPercent: 0, mrp: 465,
        currentStock: 24, minimumStock: 10, unit: 'kg', hsnCode: '1101',
        batchNumber: 'A10', expiryDate: '2026-06-30', manufacturer: 'ITC',
        supplierId: '', imagePath: '', variants: '10kg', createdAt: now,
      },
      {
        id: 'prod_5', name: 'Parle-G Biscuits 800g', categoryId: 'cat_snacks', brand: 'Parle',
        barcode: '8901234567999', purchasePrice: 72, sellingPrice: 80, gstPercent: 0, mrp: 90,
        currentStock: 150, minimumStock: 40, unit: 'pcs', hsnCode: '1905',
        batchNumber: 'PG24', expiryDate: '2026-03-31', manufacturer: 'Parle',
        supplierId: '', imagePath: '', variants: '800g', createdAt: now,
      },
    ],
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
    // Migration: ensure share_shortcuts always exists
    if (!Array.isArray(parsed.share_shortcuts)) parsed.share_shortcuts = [];
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
  // Debounced cloud sync so laptop + phone share the same data
  if (_cloudUid) {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => {
      if (!_cloudUid) return;
      saveUserDataToCloud(_cloudUid, dbData).catch((e) =>
        console.error('cloud sync write failed', e),
      );
    }, 400);
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
  },

  getCustomers(): Customer[] {
    return read().customers.sort((a, b) => a.name.localeCompare(b.name));
  },
  addCustomer(c: Customer) {
    const d = read();
    d.customers.push(c);
    write(d);
  },
  updateCustomer(c: Customer) {
    const d = read();
    const i = d.customers.findIndex((x) => x.id === c.id);
    if (i >= 0) d.customers[i] = c;
    write(d);
  },
  deleteCustomer(id: string) {
    const d = read();
    const refsInv = d.invoices.some((x) => x.customerId === id);
    const refsPay = d.payments.some((x) => x.customerId === id);
    if (refsInv || refsPay) {
      const c = d.customers.find((x) => x.id === id);
      throw new Error(
        `Cannot delete customer "${c?.name || 'Customer'}" because ${
          refsInv ? d.invoices.filter((x) => x.customerId === id).length + ' invoice(s)' :
          d.payments.filter((x) => x.customerId === id).length + ' payment(s)'
        } reference them. Delete the related invoices first, or edit instead.`,
      );
    }
    d.customers = d.customers.filter((x) => x.id !== id);
    write(d);
  },
  getCustomerById(id: string): Customer {
    const found = read().customers.find((x) => x.id === id);
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
    return read().products.sort((a, b) => a.name.localeCompare(b.name));
  },
  addProduct(p: Product) {
    const d = read();
    d.products.push(p);
    write(d);
  },
  updateProduct(p: Product) {
    const d = read();
    const i = d.products.findIndex((x) => x.id === p.id);
    if (i >= 0) d.products[i] = p;
    write(d);
  },
  deleteProduct(id: string) {
    const d = read();
    const refs = d.invoice_items.some((x) => x.productId === id);
    if (refs) {
      const p = d.products.find((x) => x.id === id);
      throw new Error(
        `Cannot delete product "${p?.name || 'Product'}" because it's used in one or more invoices. Keep it in the list or archive via edit.`,
      );
    }
    d.products = d.products.filter((x) => x.id !== id);
    write(d);
  },
  getProductById(id: string): Product {
    const found = read().products.find((x) => x.id === id);
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
  },

  getPayments(): Payment[] {
    return read().payments.sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));
  },

  getCategories(): Category[] {
    return read().categories;
  },

  /**
   * Create short link + save token to Firebase so customer phones can open it.
   * Always re-uploads the latest token to Firebase (invoice data may change).
   */
  getOrCreateShareShortcut(args: { invoiceId: string; token: string }): ShareShortcut {
    const d = read();
    const existing = d.share_shortcuts.find((s) => s.invoiceId === args.invoiceId);
    if (existing) {
      existing.token = args.token;
      write(d);
      // Must reach Firebase — otherwise customer link spins forever
      void saveShareToFirebase(existing.shortId, {
        invoiceId: existing.invoiceId,
        token: args.token,
      });
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

  /** Explicitly push a short link to Firebase and return success */
  async publishShareToCloud(shortId: string, invoiceId: string, token: string): Promise<boolean> {
    return saveShareToFirebase(shortId, { invoiceId, token });
  },

  /** Bind logged-in user and pull cloud data onto this device */
  async bindCloudUser(uid: string): Promise<{ fromCloud: boolean }> {
    _cloudUid = uid;
    const remote = await loadUserDataFromCloud(uid);
    if (remote && typeof remote === 'object') {
      const payload = remote as DB;
      // Basic shape check
      if (payload.business_profile && Array.isArray(payload.products)) {
        if (!Array.isArray(payload.share_shortcuts)) payload.share_shortcuts = [];
        localStorage.setItem(KEY, JSON.stringify(payload));
        _notify();
        return { fromCloud: true };
      }
    }
    // No cloud data yet — push current local (or seed) up so other devices can pull it
    const local = read();
    await saveUserDataToCloud(uid, local);
    return { fromCloud: false };
  },

  clearCloudUser() {
    _cloudUid = null;
  },

  /** Force immediate cloud upload of current local data */
  async forceCloudPush(): Promise<boolean> {
    if (!_cloudUid) return false;
    return saveUserDataToCloud(_cloudUid, read());
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

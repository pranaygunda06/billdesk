import type { Customer, Invoice, InvoiceItem } from '../types';

export interface PaymentTokenPayload {
  v: 1;
  i: Invoice;
  c: Customer;
  it: InvoiceItem[];
  b: {
    name: string;
    upiId: string;
    address?: string;
    phone?: string;
    gstNumber?: string;
    terms?: string;
    footer?: string;
    returnPolicy?: string;
  };
}

type CompactPayload = {
  v: 1;
  i: Record<string, any>;
  c: Record<string, any>;
  it: Array<Record<string, any>>;
  b: Record<string, any>;
};

const I_MAP: Record<string, string> = {
  id: 'a', invoiceNumber: 'b', invoiceDate: 'c', dueDate: 'd', customerId: 'e',
  subtotal: 'f', discountPercent: 'g', discount: 'h', gstAmount: 'i', grandTotal: 'j',
  taxInclusive: 'k', roundOff: 'l', paidAmount: 'm', outstandingAmount: 'n',
  status: 'o', paymentStatus: 'p', paymentMethod: 'q', notes: 'r', createdAt: 's', updatedAt: 't',
  businessId: 'u',
};
const I_INV: Record<string, string> = Object.fromEntries(Object.entries(I_MAP).map(([k, v]) => [v, k]));

const C_MAP: Record<string, string> = {
  id: 'a', name: 'b', phone: 'c', whatsapp: 'd', address: 'e', gstNumber: 'f',
  creditLimit: 'g', openingBalance: 'h', outstandingBalance: 'i', notes: 'j',
  location: 'k', tags: 'l', favorite: 'm', creditDays: 'n', createdAt: 'o',
};
const C_INV: Record<string, string> = Object.fromEntries(Object.entries(C_MAP).map(([k, v]) => [v, k]));

const IT_MAP: Record<string, string> = {
  id: 'a', invoiceId: 'b', productId: 'c', name: 'd', hsnCode: 'e', quantity: 'f',
  unit: 'g', unitPrice: 'h', discount: 'i', discountPercent: 'j', taxableValue: 'k',
  gstPercent: 'l', gstAmount: 'm', lineTotal: 'n', isReturnItem: 'o', batchNumber: 'p',
  expiryDate: 'q',
};
const IT_INV: Record<string, string> = Object.fromEntries(Object.entries(IT_MAP).map(([k, v]) => [v, k]));

const B_MAP: Record<string, string> = {
  name: 'a', upiId: 'b', address: 'c', phone: 'd', gstNumber: 'e', terms: 'f', footer: 'g', returnPolicy: 'h',
};
const B_INV: Record<string, string> = Object.fromEntries(Object.entries(B_MAP).map(([k, v]) => [v, k]));

function compactObj(obj: Record<string, any>, map: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const short = map[k];
    const val = obj[k];
    if (val === undefined || val === null || val === '' || val === 0) continue;
    if (short) out[short] = val;
  }
  return out;
}
function expandObj(obj: Record<string, any>, inv: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const long = inv[k];
    if (long) out[long] = obj[k];
    else out[k] = obj[k];
  }
  return out;
}

function defaultInvoice(): Record<string, any> {
  return {
    discountPercent: 0, discount: 0, roundOff: 0, paidAmount: 0,
    outstandingAmount: 0, taxInclusive: false, notes: '', businessId: 'biz1',
  };
}
function defaultCustomer(): Record<string, any> {
  return {
    whatsapp: '', address: '', gstNumber: '', creditLimit: 0, openingBalance: 0,
    outstandingBalance: 0, notes: '', location: '', tags: '', favorite: false,
    creditDays: 0,
  };
}
function defaultInvoiceItem(): Record<string, any> {
  return {
    hsnCode: '', unit: 'pcs', discount: 0, discountPercent: 0, taxableValue: 0,
    gstPercent: 0, gstAmount: 0, isReturnItem: false, batchNumber: '', expiryDate: '',
  };
}
function defaultBiz(): Record<string, any> {
  return { address: '', phone: '', gstNumber: '', terms: '', footer: '', returnPolicy: '' };
}

function b64EncodeUnicode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64DecodeUnicode(safe: string): string | null {
  try {
    const b64 = safe.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodePaymentToken(p: PaymentTokenPayload): string {
  const compact: CompactPayload = {
    v: 1,
    i: compactObj(p.i as unknown as Record<string, any>, I_MAP),
    c: compactObj(p.c as unknown as Record<string, any>, C_MAP),
    it: (p.it as unknown as Record<string, any>[]).map(x => compactObj(x, IT_MAP)),
    b: compactObj(p.b, B_MAP),
  };
  return b64EncodeUnicode(JSON.stringify(compact));
}

export function decodePaymentToken(token: string): PaymentTokenPayload | null {
  if (!token) return null;
  try {
    const json = b64DecodeUnicode(token);
    if (!json) return null;
    const obj = JSON.parse(json);
    if (!obj || !obj.i || !obj.c || !Array.isArray(obj.it) || !obj.b) return null;

    const expI = { ...defaultInvoice(), ...expandObj(obj.i, I_INV) };
    const expC = { ...defaultCustomer(), ...expandObj(obj.c, C_INV) };
    const expItems = (obj.it as any[]).map((it: any) => ({ ...defaultInvoiceItem(), ...expandObj(it, IT_INV) }));
    const expB = { ...defaultBiz(), ...expandObj(obj.b, B_INV) };

    // Backfill numbers/booleans safely
    const num = (v: any, fallback = 0) => typeof v === 'number' ? v : (Number(v) || fallback);
    const bool = (v: any, fallback = false) => typeof v === 'boolean' ? v : fallback;

    return {
      v: 1,
      i: {
        ...expI,
        subtotal: num(expI.subtotal),
        discount: num(expI.discount),
        discountPercent: num(expI.discountPercent),
        gstAmount: num(expI.gstAmount),
        grandTotal: num(expI.grandTotal),
        roundOff: num(expI.roundOff),
        paidAmount: num(expI.paidAmount),
        outstandingAmount: num(expI.outstandingAmount),
        taxInclusive: bool(expI.taxInclusive),
        favorite: bool((expI as any).favorite),
      } as unknown as Invoice,
      c: {
        ...expC,
        creditLimit: num(expC.creditLimit),
        openingBalance: num(expC.openingBalance),
        outstandingBalance: num(expC.outstandingBalance),
        creditDays: num(expC.creditDays),
        favorite: bool(expC.favorite),
      } as unknown as Customer,
      it: expItems.map(it => ({
        ...it,
        quantity: num(it.quantity),
        unitPrice: num(it.unitPrice),
        discount: num(it.discount),
        discountPercent: num(it.discountPercent),
        taxableValue: num(it.taxableValue),
        gstPercent: num(it.gstPercent),
        gstAmount: num(it.gstAmount),
        lineTotal: num(it.lineTotal),
        isReturnItem: bool(it.isReturnItem),
      })) as unknown as InvoiceItem[],
      b: expB as PaymentTokenPayload['b'],
    };
  } catch {
    return null;
  }
}

export function buildPaymentLink(origin: string, token: string): string {
  return `${origin}/#/pay/${token}`;
}

export function originOf(): string {
  try { return window.location.origin; } catch { return ''; }
}

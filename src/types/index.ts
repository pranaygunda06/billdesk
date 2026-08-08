export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  gstNumber: string;
  creditLimit: number;
  openingBalance: number;
  outstandingBalance: number;
  notes: string;
  location: string;
  tags: string;
  favorite: boolean;
  birthDate?: string;
  anniversaryDate?: string;
  creditDays: number;
  lastPaymentDate?: string;
  lastOrderDate?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  brand: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  gstPercent: number;
  mrp: number;
  currentStock: number;
  minimumStock: number;
  unit: string;
  hsnCode: string;
  batchNumber: string;
  expiryDate: string;
  manufacturer: string;
  supplierId: string;
  imagePath: string;
  variants: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  supplierId?: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  gstAmount: number;
  grandTotal: number;
  receivedAmount: number;
  outstandingAmount: number;
  status: string;
  paymentStatus: 'Unpaid' | 'Paid' | 'Partially Paid' | string;
  notes: string;
  terms: string;
  footer: string;
  returnPolicy: string;
  signaturePath: string;
  qrCode: string;
  whatsappTemplate: string;
  printSize: string;
  isDraft: boolean;
  isHold: boolean;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  gstPercent: number;
  lineTotal: number;
}

export interface ShareShortcut {
  id: string;
  shortId: string;
  invoiceId: string;
  token: string;
  createdAt: string;
  accessedAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  method: string;
  status: string;
  transactionRef: string;
  paidAt: string;
  notes: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  gstNumber: string;
  upiId: string;
  invoicePrefix: string;
  invoiceFooter: string;
  terms: string;
  returnPolicy: string;
  signaturePath: string;
  logoPath: string;
  themeMode: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

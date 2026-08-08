import type { BusinessProfile, Customer, Invoice } from '../types';

export function buildUpiLink(params: {
  upiId: string;
  payeeName: string;
  amount?: number;
  note?: string;
  ref?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('pa', params.upiId);
  qs.set('pn', params.payeeName);
  qs.set('cu', 'INR');
  if (params.amount && params.amount > 0) qs.set('am', params.amount.toFixed(2));
  if (params.note) qs.set('tn', params.note);
  if (params.ref) qs.set('tr', params.ref);
  return `upi://pay?${qs.toString()}`;
}

export function fixedAmountUpiLink(
  business: BusinessProfile,
  invoice: Invoice,
): string {
  return buildUpiLink({
    upiId: business.upiId || 'psenterprises@upi',
    payeeName: business.name || 'PS Enterprises',
    amount: invoice.grandTotal,
    note: `Invoice ${invoice.invoiceNumber}`,
    ref: invoice.invoiceNumber,
  });
}

export function customAmountUpiLink(
  business: BusinessProfile,
  invoice?: Invoice,
): string {
  return buildUpiLink({
    upiId: business.upiId || 'psenterprises@upi',
    payeeName: business.name || 'PS Enterprises',
    note: invoice ? `Payment for Invoice ${invoice.invoiceNumber}` : `Payment to ${business.name || 'PS Enterprises'}`,
    ref: invoice?.invoiceNumber,
  });
}

export function buildWhatsAppMessage(
  business: BusinessProfile,
  customer: Customer,
  invoice: Invoice,
  fixedLink: string,
  customLink: string,
  paymentPageLink?: string,
): string {
  const totalStr = `₹${invoice.grandTotal.toFixed(2)}`;
  const businessName = business.name || 'PS Enterprises';

  if (paymentPageLink) {
    return [
      `🙏 Hello ${customer.name},`,
      '',
      `🧾 New Invoice from *${businessName}*`,
      `📄 No: *${invoice.invoiceNumber}*`,
      `💰 Total: *${totalStr}*`,
      '',
      `🔗 Tap the link below to view invoice & pay instantly:`,
      paymentPageLink,
      '',
      `The page has a big scannable UPI QR + button to open Google Pay / PhonePe / Paytm.`,
      '',
      `Thank you for your business! 💙`,
      `— ${businessName}`,
    ].join('\n');
  }

  return [
    `*${businessName}*`,
    '',
    `Thank you for your purchase, ${customer.name}.`,
    '',
    `🧾 *Invoice: ${invoice.invoiceNumber}*`,
    `💰 Bill Amount: *${totalStr}*`,
    '',
    `💳 *Pay Exact Amount:*`,
    fixedLink,
    '',
    `✏️ *Pay Custom Amount:*`,
    customLink,
    '',
    `Tap the link, choose Google Pay / PhonePe / Paytm, and tap Pay.`,
    '',
    `Thank you for your business! 🙏`,
  ].join('\n');
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const prefix = clean.startsWith('91') ? clean : `91${clean}`;
  return `https://wa.me/${prefix}?text=${encodeURIComponent(message)}`;
}

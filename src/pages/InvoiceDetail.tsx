import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import QRCode from 'react-qr-code';
import { db } from '../lib/db';
import { useDbTick } from '../hooks/useDbTick';
import InvoicePreviewCard from '../components/InvoicePreviewCard';
import { clsx, formatCurrency, formatDate } from '../lib/utils';
import { buildWhatsAppMessage, buildWhatsAppUrl, customAmountUpiLink, fixedAmountUpiLink } from '../lib/upi';
import { buildPaymentLink, encodePaymentToken, originOf } from '../lib/paymentLink';
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Share2,
  Printer,
  Copy,
  Download,
  Phone,
  IndianRupee,
  QrCode,
  Sparkles,
  FileCheck2,
  FileText,
  Eye,
  ExternalLink,
  Link2,
} from 'lucide-react';

export default function InvoiceDetail() {
  useDbTick();
  const { id } = useParams();
  const nav = useNavigate();
  const invoice = id ? db.getInvoiceById(id) : undefined;
  const items = invoice ? db.getInvoiceItems(invoice.id) : [];
  const customer = invoice ? db.getCustomerById(invoice.customerId) : null;
  const business = db.getBusinessProfile();
  const invRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string>('');

  const fixedLink = useMemo(() => business && invoice ? fixedAmountUpiLink(business, invoice) : '', [business, invoice]);
  const customLink = useMemo(() => business && invoice ? customAmountUpiLink(business, invoice) : '', [business, invoice]);

  const { paymentToken, paymentLink, shortLink, shortId } = useMemo(() => {
    if (!invoice || !customer || !business) return { paymentToken: '', paymentLink: '', shortLink: '', shortId: '' };
    const payload: import('../lib/paymentLink').PaymentTokenPayload = {
      v: 1,
      i: invoice,
      c: customer,
      it: items,
      b: {
        name: business.name,
        upiId: business.upiId,
        address: business.address,
        phone: business.phone,
        gstNumber: business.gstNumber,
        terms: business.terms,
        footer: business.invoiceFooter,
        returnPolicy: business.returnPolicy,
      },
    };
    const token = encodePaymentToken(payload);
    const shortcut = db.getOrCreateShareShortcut({ invoiceId: invoice.id, token });
    const origin = originOf();
    return {
      paymentToken: token,
      paymentLink: buildPaymentLink(origin, token),
      shortId: shortcut.shortId,
      shortLink: `${origin}/#/p/${shortcut.shortId}`,
    };
  }, [invoice, customer, business, items]);

  // Ensure short link is on Firebase + full DB is cloud-synced (so other devices + customers work)
  useEffect(() => {
    if (!shortId || !paymentToken || !invoice) return;
    let cancelled = false;
    (async () => {
      const ok = await db.publishShareToCloud(shortId, invoice.id, paymentToken);
      await db.forceCloudPush();
      if (!cancelled && !ok) {
        setToast('Warning: customer link may not work on other phones — check Firebase rules');
        setTimeout(() => setToast(''), 4000);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shortId, paymentToken, invoice]);

  const waMessage = useMemo(() => {
    if (!business || !customer || !invoice) return '';
    return buildWhatsAppMessage(business, customer, invoice, fixedLink, customLink, (shortLink || paymentLink) || undefined);
  }, [business, customer, invoice, fixedLink, customLink, shortLink, paymentLink]);
  const waUrl = useMemo(() => {
    if (!customer) return '';
    return buildWhatsAppUrl(customer.whatsapp || customer.phone, waMessage);
  }, [customer, waMessage]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  async function capturePngBlob(): Promise<Blob | null> {
    if (!invRef.current) return null;
    // Wait until QR <img> is fully loaded (raster PNG, not SVG)
    const waitForImages = async () => {
      const imgs = Array.from(invRef.current!.querySelectorAll('img'));
      await Promise.all(
        imgs.map(
          (img) =>
            img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                  setTimeout(res, 2500);
                }),
        ),
      );
      // If QR still loading, give it a bit more time
      const hasQr = imgs.some((i) => i.alt === 'Invoice QR' || (i.naturalWidth > 0 && i.width >= 80));
      if (!hasQr) await new Promise((r) => setTimeout(r, 600));
    };
    await waitForImages();
    await new Promise((r) => setTimeout(r, 80));

    const canvas = await html2canvas(invRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 520,
      onclone: (_doc, el) => {
        el.style.width = '480px';
        el.style.maxWidth = '480px';
        el.style.transform = 'none';
        el.style.overflow = 'visible';
        el.style.fontFamily = 'Arial, Helvetica, sans-serif';
        // Force all text nodes to system font to avoid garbled Inter metrics
        el.querySelectorAll('*').forEach((node) => {
          const h = node as HTMLElement;
          if (h.style) {
            h.style.fontFamily = 'Arial, Helvetica, sans-serif';
            h.style.letterSpacing = 'normal';
          }
        });
      },
    });
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 1.0));
  }

  async function downloadPng() {
    const blob = await capturePngBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${invoice?.invoiceNumber || 'bill'}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Invoice image downloaded ✓');
  }

  async function copy(text: string, label = 'Copied') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} ✓`);
    } catch {
      showToast('Copy failed');
    }
  }

  async function openWhatsAppOnly() {
    if (!customer) return;
    try {
      const blob = await capturePngBlob();
      const canShareFiles = !!navigator.share && blob && Array.isArray((navigator as any).canShare?.({ files: [new File([blob], 'x.png', { type: 'image/png' })] }) ? (navigator as any).canShare({ files: [new File([blob], 'x.png', { type: 'image/png' })] }) : false);
      if (blob && (navigator as any).canShare && (navigator as any).canShare({ files: [new File([blob], `Invoice-${invoice?.invoiceNumber || 'bill'}.png`, { type: 'image/png' })] })) {
        const file = new File([blob], `Invoice-${invoice?.invoiceNumber || 'bill'}.png`, { type: 'image/png' });
        await navigator.share({
          title: `${business?.name || 'PS Enterprises'} — Invoice ${invoice?.invoiceNumber}`,
          text: waMessage,
          files: [file],
        });
        showToast('Shared via Web Share ✓');
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
    // Fallback: plain WhatsApp URL with the rich message (images can't be attached via URL alone, user can manually attach after)
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast('WhatsApp opened with message. Re-share image via Share Bill.');
  }

  async function shareBill() {
    try {
      const blob = await capturePngBlob();
      if (blob && (navigator as any).canShare && (navigator as any).canShare({ files: [new File([blob], `Invoice-${invoice?.invoiceNumber || 'bill'}.png`, { type: 'image/png' })] })) {
        const file = new File([blob], `Invoice-${invoice?.invoiceNumber || 'bill'}.png`, { type: 'image/png' });
        await navigator.share({
          title: `Invoice ${invoice?.invoiceNumber}`,
          text: waMessage,
          files: [file],
        });
        showToast('Invoice image shared ✓');
        return;
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }
    await downloadPng();
  }

  function shareLinks() {
    const combined = waMessage;
    if (navigator.share) {
      navigator.share({ title: `Invoice ${invoice?.invoiceNumber}`, text: combined }).catch(() => {});
    } else {
      copy(combined, 'Payment links copied');
    }
  }

  function printBill() {
    window.print();
  }

  function markPaid() {
    if (!invoice) return;
    const ok = confirm(`Mark invoice ${invoice.invoiceNumber} as PAID for ${formatCurrency(invoice.outstandingAmount)}?`);
    if (!ok) return;
    db.markInvoicePaid(invoice.id);
    showToast('Marked as Paid ✓');
  }

  if (!invoice || !customer) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
        <FileText size={40} className="mx-auto text-slate-300 mb-3"/>
        <div className="font-bold text-slate-700">Invoice not found</div>
        <div className="text-sm text-slate-500 mt-1">It may have been deleted.</div>
        <Link to="/reports" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">← Back to Invoices</Link>
      </div>
    );
  }

  const paid = invoice.paymentStatus.toLowerCase() === 'paid' || invoice.outstandingAmount <= 0;

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 no-print">
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16}/> Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => copy(shortLink || paymentLink, 'Payment link copied')} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-brand-50 hover:from-indigo-100 hover:to-brand-100 border border-indigo-200 text-brand-800 text-sm font-bold px-3.5 py-2 rounded-lg">
            <Link2 size={15}/> Copy Pay Link
          </button>
          <a href={`/#/p/${shortId || ''}`} target="_blank" rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3.5 py-2 rounded-lg">
            <ExternalLink size={15}/> Preview Page
          </a>
          <button onClick={() => copy(waMessage, 'Message copied')} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3.5 py-2 rounded-lg">
            <Copy size={15}/> Copy Msg
          </button>
          <button onClick={shareLinks} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3.5 py-2 rounded-lg">
            <Share2 size={15}/> Share Links
          </button>
          <button onClick={downloadPng} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3.5 py-2 rounded-lg">
            <Download size={15}/> Save PNG
          </button>
          <button onClick={printBill} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold px-3.5 py-2 rounded-lg">
            <Printer size={15}/> Print
          </button>
          {!paid && (
            <button onClick={markPaid} className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-pop">
              <CheckCircle2 size={15}/> Mark as Paid
            </button>
          )}
          {paid && (
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-sm font-bold px-4 py-2 rounded-lg">
              <FileCheck2 size={15}/> Paid
            </span>
          )}
        </div>
      </div>

      <div className={`rounded-2xl overflow-hidden shadow-card text-white ${paid ? '' : ''}`}
        style={{ background: paid ? 'linear-gradient(135deg,#059669 0%,#0f766e 100%)' : 'linear-gradient(135deg,#ea580c 0%,#b45309 100%)' }}>
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
          <div>
            <div className="text-white/70 text-[11px] font-bold uppercase tracking-wider">Invoice</div>
            <div className="text-2xl font-extrabold tracking-wide mt-0.5">{invoice.invoiceNumber}</div>
            <div className="text-white/80 text-sm">{formatDate(invoice.invoiceDate)} · Due {formatDate(invoice.dueDate)}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-white/70 text-[11px] font-bold uppercase tracking-wider">Grand Total</div>
              <div className="text-3xl font-extrabold">{formatCurrency(invoice.grandTotal)}</div>
            </div>
            <div className={`px-4 py-2 rounded-xl text-sm font-bold backdrop-blur ${paid ? 'bg-white/15' : 'bg-black/15'}`}>
              {paid ? '✓ Payment Received' : `⚑ Outstanding ${formatCurrency(invoice.outstandingAmount)}`}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Invoice preview column */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 no-print">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
                <Eye size={16} className="text-brand-600"/> Invoice Preview
              </div>
              <div className="text-[11px] text-slate-400">This exact image is sent to customer</div>
            </div>
            <div className="flex justify-center rounded-xl bg-slate-50 p-2 sm:p-6 border border-dashed border-slate-200 overflow-x-auto">
              <div className="invoice-preview-scale rounded-xl shadow-pop ring-1 ring-slate-200 overflow-hidden bg-white">
                <InvoicePreviewCard
                  ref={invRef}
                  invoice={invoice}
                  items={items}
                  customer={customer}
                  business={business}
                  publicLink={shortLink || paymentLink}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Quick Payment, Customer, Summary */}
        <div className="space-y-5">
          {/* Quick Payment */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50/60">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0"><IndianRupee size={16}/></div>
              <div>
                <div className="font-bold text-slate-900">Quick Payment</div>
                <div className="text-[11px] text-slate-500">UPI — any app in India</div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-center py-3">
                <div className="p-3 bg-white ring-2 ring-emerald-200 rounded-xl shadow-pop">
                  <QRCode value={fixedLink} size={150} fgColor="#1e1b4b"/>
                </div>
              </div>
              <a href={fixedLink} target="_blank" rel="noreferrer"
                className="block text-center rounded-xl bg-gradient-to-r from-[#1e1b4b] to-indigo-800 text-white font-bold py-3 hover:opacity-95 transition">
                <span className="inline-flex items-center gap-2"><QrCode size={16}/> Pay Exact {formatCurrency(invoice.grandTotal)}</span>
              </a>
              <a href={customLink} target="_blank" rel="noreferrer"
                className="block text-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2.5 text-sm">
                Pay Custom Amount
              </a>
              <div className="space-y-2">
                <LinkCopy label="Fixed Amount UPI" text={fixedLink} onCopy={() => showToast('Fixed link copied ✓')}/>
                <LinkCopy label="Custom Amount UPI" text={customLink} onCopy={() => showToast('Custom link copied ✓')}/>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">👤</div>
              <div>
                <div className="font-bold text-slate-900">Customer</div>
                <div className="text-[11px] text-slate-500">Contact & reach</div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center font-bold">
                  {customer.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{customer.name}</div>
                  <div className="text-xs text-slate-500">📞 {customer.phone}</div>
                </div>
              </div>
              {customer.outstandingBalance > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs">
                  <span className="font-bold text-amber-700">Total Outstanding:</span> <span className="font-extrabold text-amber-800">{formatCurrency(customer.outstandingBalance)}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${customer.phone}`} className="inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold py-2.5 rounded-lg">
                  <Phone size={15}/> Call
                </a>
                <a href={waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 bg-whatsapp-500 hover:bg-whatsapp-600 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm">
                  <MessageCircle size={15}/> WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Send to Customer - primary CTA */}
          <button
            onClick={openWhatsAppOnly}
            className="w-full rounded-2xl shadow-pop overflow-hidden text-left group"
            style={{ background: 'linear-gradient(135deg,#128C7E 0%,#25D366 100%)' }}
          >
            <div className="px-6 py-5 text-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                  <MessageCircle size={22}/>
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-lg leading-tight">📤 Send to Customer</div>
                  <div className="text-white/80 text-xs mt-0.5">Invoice image + message + both UPI links</div>
                </div>
              </div>
              <Share2 size={22} className="shrink-0 group-hover:scale-110 transition"/>
            </div>
          </button>

          {/* Shareable link */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-brand-50/60">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-brand-700 text-white flex items-center justify-center shrink-0"><Link2 size={15}/></div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Shareable Payment Link</div>
                <div className="text-[11px] text-slate-500">Works on WhatsApp, SMS, email. Customer lands on mobile pay page.</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">✨ Short link (clean)</div>
                  <span className="text-[10px] text-slate-400">Works on this device</span>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0 text-[12px] font-mono text-emerald-800 truncate" title={shortLink}>{shortLink || '—'}</div>
                  <button onClick={() => copy(shortLink, 'Short link copied ✓')} className="shrink-0 text-[11px] font-bold text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1 bg-white border border-emerald-300 px-2 py-1 rounded">
                    <Copy size={12}/> Copy
                  </button>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">🔐 Full link (always works)</div>
                  <span className="text-[10px] text-slate-400">Any device, no DB</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0 text-[12px] font-mono text-slate-600 truncate" title={paymentLink}>{paymentLink || '—'}</div>
                  <button onClick={() => copy(paymentLink, 'Payment link copied ✓')} className="shrink-0 text-[11px] font-bold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 bg-white border border-brand-200 px-2 py-1 rounded">
                    <Copy size={12}/> Copy
                  </button>
                </div>
              </div>
              <a href={`/#/p/${shortId || ''}`} target="_blank" rel="noreferrer"
                className="w-full rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider py-2 inline-flex items-center justify-center gap-1.5">
                <ExternalLink size={13}/> Open short link in new tab
              </a>
              <div className="text-[11px] leading-snug text-slate-500 space-y-1">
                <div>💡 Send the green SHORT link — it's 85% shorter and looks nicer.</div>
                <div>🛟 If a customer ever opens on an unknown device and the short link says "Not found", send the 🔐 full link. It works 100% anywhere.</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <Sparkles size={13}/> Bill Summary
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(invoice.subtotal)} />
              {invoice.discount > 0 && <Row label={`Discount`} value={`- ${formatCurrency(invoice.discount)}`} negative/>}
              <Row label="GST" value={formatCurrency(invoice.gstAmount)} />
              <div className="border-t border-slate-100 pt-2 mt-2 flex items-center justify-between">
                <span className="font-bold text-slate-800">Grand Total</span>
                <span className="font-extrabold text-lg text-slate-900">{formatCurrency(invoice.grandTotal)}</span>
              </div>
              <Row label="Received" value={formatCurrency(invoice.receivedAmount)} />
              <div className={`rounded-lg px-3 py-2 flex items-center justify-between ${paid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${paid ? 'text-emerald-700' : 'text-amber-700'}`}>Outstanding</span>
                <span className={`font-extrabold ${paid ? 'text-emerald-800' : 'text-amber-800'}`}>{formatCurrency(invoice.outstandingAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={clsx('font-semibold', negative ? 'text-rose-600' : 'text-slate-800')}>{value}</span>
    </div>
  );
}

function LinkCopy({ label, text, onCopy }: { label: string; text: string; onCopy: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="flex-1 text-[11px] text-slate-600 truncate font-mono">{text}</div>
        <button onClick={() => { navigator.clipboard.writeText(text); onCopy(); }}
          className="shrink-0 text-[11px] font-bold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1">
          <Copy size={12}/> Copy
        </button>
      </div>
    </div>
  );
}

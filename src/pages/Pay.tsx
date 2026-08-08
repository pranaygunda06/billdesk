import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import QRCode from 'react-qr-code';
import html2canvas from 'html2canvas';
import { decodePaymentToken, type PaymentTokenPayload } from '../lib/paymentLink';
import { db } from '../lib/db';
import { getShareFromFirebase } from '../lib/firebase';
import { formatCurrency, formatDate, clsx, swapCanvasesToImages } from '../lib/utils';
import { buildUpiLink } from '../lib/upi';
import { ArrowLeft, CheckCircle2, Copy, Download, QrCode, Share2, Sparkles, Phone, MessageCircle, IndianRupee, RefreshCw } from 'lucide-react';

export default function Pay() {
  const { token = '' } = useParams();
  const location = useLocation();
  const isShort = location.pathname.startsWith('/p/') || (token.length <= 12 && /^[A-Za-z0-9]+$/.test(token));

  const [resolvedToken, setResolvedToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState<PaymentTokenPayload | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [toast, setToast] = useState('');
  const invRef = useRef<HTMLDivElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Resolve short link: local first, then Firebase (with timeout so UI never spins forever)
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setResolvedToken('');

      try {
        if (!isShort) {
          // Full long token in the URL
          if (!cancelled) setResolvedToken(token);
          return;
        }

        // 1. Same browser (seller device) — local shortcut
        try {
          const local = db.getShareByShortId(token);
          if (local?.token) {
            if (!cancelled) setResolvedToken(local.token);
            return;
          }
        } catch {
          /* ignore local errors */
        }

        // 2. Firebase — works on customer phone / any network
        const remote = await getShareFromFirebase(token);
        if (!cancelled) {
          setResolvedToken(remote?.token || '');
        }
      } catch (e) {
        console.error('Pay resolve failed', e);
        if (!cancelled) setResolvedToken('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [token, isShort]);

  // Decode once we have the token
  useEffect(() => {
    if (loading) return;
    const data = decodePaymentToken(resolvedToken);
    setPaid(data);
    if (data) {
      const title = `Pay ₹${data.i.grandTotal.toFixed(2)} — ${data.i.invoiceNumber} · ${data.b.name}`;
      document.title = title;
      setMeta('description', `Invoice ${data.i.invoiceNumber} from ${data.b.name} · ₹${data.i.grandTotal.toFixed(2)} · Pay via UPI`);
      setMeta('og:title', title, true);
      setMeta('og:description', `Pay ₹${data.i.grandTotal.toFixed(2)} to ${data.b.name} via UPI for invoice ${data.i.invoiceNumber}`, true);
      setMeta('og:type', 'website', true);
      setMeta('og:url', window.location.href, true);
      setMeta('og:site_name', data.b.name, true);
      setMeta('twitter:card', 'summary_large_image', true);
      setMeta('twitter:title', title, true);
      setMeta('twitter:description', `Invoice ${data.i.invoiceNumber}`, true);
    }
  }, [resolvedToken, loading]);

  const fixedLink = useMemo(() => {
    if (!paid) return '';
    return buildUpiLink({
      upiId: paid.b.upiId || 'psenterprises@upi',
      payeeName: paid.b.name || 'PS Enterprises',
      amount: paid.i.grandTotal,
      note: `Invoice ${paid.i.invoiceNumber}`,
      ref: paid.i.invoiceNumber,
    });
  }, [paid]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-slate-600 font-medium">Loading invoice…</div>
        </div>
      </div>
    );
  }

  if (!paid) {
    const shortFailed = isShort && !resolvedToken;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-slate-100 p-8">
          <div className={`w-16 h-16 rounded-2xl ${shortFailed ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'} flex items-center justify-center mx-auto mb-4`}>
            <RefreshCw size={30}/>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 text-center">
            {shortFailed ? 'Link not found' : 'Invalid payment link'}
          </h1>
          {shortFailed ? (
            <div className="mt-3 text-slate-500 text-sm space-y-2 text-center">
              <p>This short link could not be found. It may have expired or the invoice was never synced.</p>
              <p className="font-semibold text-slate-700">Ask the sender to share the full payment link instead.</p>
            </div>
          ) : (
            <p className="mt-2 text-slate-500 text-sm text-center">This link seems broken or has expired. Ask the sender to share a fresh invoice link.</p>
          )}
          <div className="mt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">← Back to PS Enterprises</Link>
          </div>
        </div>
      </div>
    );
  }

  const { i: inv, c: cust, it: items, b: biz } = paid;
  const invPaid = isPaid || inv.outstandingAmount <= 0;

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  }

  async function downloadPng() {
    if (!invRef.current) return;
    const swap = swapCanvasesToImages(invRef.current);
    try {
      const canvas = await html2canvas(invRef.current, { backgroundColor: '#ffffff', scale: 2, windowWidth: 480, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Invoice-${inv.invoiceNumber}.png`; a.click();
        URL.revokeObjectURL(url);
        showToast('Invoice image saved ✓');
      }, 'image/png');
    } finally {
      swap.restore();
    }
  }

  async function shareLink() {
    try {
      if (navigator.share) await navigator.share({ title: `Invoice ${inv.invoiceNumber}`, text: `Pay ${formatCurrency(inv.grandTotal)} to ${biz.name}`, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Payment link copied ✓');
      }
    } catch { /* cancelled */ }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 pb-16">
      {/* Status banner */}
      <div className={clsx(
        'relative overflow-hidden text-white',
        invPaid ? 'bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800' : 'bg-gradient-to-br from-[#1e1b4b] via-indigo-700 to-[#1e1b4b]'
      )}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse at 20% 20%, white 0%, transparent 50%), radial-gradient(ellipse at 80% 60%, white 0%, transparent 40%)' }}/>
        <div className="max-w-md mx-auto px-5 pt-6 pb-24 relative">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white">
              <ArrowLeft size={14}/> Back
            </Link>
            <button onClick={shareLink} className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 backdrop-blur rounded-full px-3 py-1.5">
              <Share2 size={12}/> Share
            </button>
          </div>
          <div className="text-center">
            <div className="text-white/70 text-[11px] font-bold uppercase tracking-wider">{invPaid ? '✅ Payment complete' : 'Amount due'}</div>
            <div className="mt-2 text-5xl font-black tracking-tight">{formatCurrency(inv.grandTotal)}</div>
            <div className="mt-2 text-white/80 text-sm font-medium">Invoice <span className="font-bold">{inv.invoiceNumber}</span> · {formatDate(inv.invoiceDate)}</div>
          </div>
        </div>
      </div>

      {/* Floating payment card */}
      <div className="max-w-md mx-auto -mt-16 px-5 space-y-5">
        {/* Quick Pay Card */}
        <div className="bg-white rounded-3xl shadow-card border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><IndianRupee size={18}/></div>
              <div>
                <div className="font-bold text-slate-900">Scan QR · Any UPI App</div>
                <div className="text-[11px] text-slate-500">GPay / PhonePe / Paytm / BHIM</div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 px-2 py-1 rounded-full">100% Safe</span>
          </div>
          {!invPaid ? (
            <div className="p-5 flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-2xl ring-2 ring-emerald-200 shadow-pop">
                <QRCode value={fixedLink} size={180} fgColor="#1e1b4b" />
              </div>
              <div className="text-center">
                <div className="font-extrabold text-[13px] text-slate-800">Pay to</div>
                <div className="font-mono text-sm font-bold text-indigo-700 break-all bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mt-1 inline-block">{biz.upiId}</div>
              </div>
              <a href={fixedLink} className="w-full text-center rounded-2xl bg-gradient-to-r from-[#1e1b4b] to-indigo-800 hover:from-[#1e1b4b] hover:to-indigo-900 text-white font-extrabold py-4 shadow-pop text-lg inline-flex items-center justify-center gap-2">
                <QrCode size={20}/> Open UPI App · {formatCurrency(inv.grandTotal)}
              </a>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button onClick={copyLink} className="rounded-xl py-2.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center justify-center gap-1.5">
                  <Copy size={15}/> {copiedLink ? 'Copied ✓' : 'Copy Link'}
                </button>
                <button onClick={downloadPng} className="rounded-xl py-2.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center justify-center gap-1.5">
                  <Download size={15}/> Invoice
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle2 size={44} className="mx-auto text-emerald-600 mb-2"/>
              <div className="font-extrabold text-lg text-slate-900">Payment Successful!</div>
              <div className="text-slate-500 text-sm mt-1">Thanks — we've recorded ₹{inv.grandTotal.toFixed(2)}</div>
            </div>
          )}
          {!invPaid && (
            <div className="px-5 pb-5">
              <button
                onClick={() => setIsPaid(true)}
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold py-3 inline-flex items-center justify-center gap-2 transition"
              >
                <Sparkles size={15}/> I have already paid · Mark as Paid
              </button>
            </div>
          )}
        </div>

        {/* Business + Customer strip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From</div>
            <div className="font-bold text-slate-900 mt-0.5 leading-snug">{biz.name}</div>
            {biz.phone && (
              <a href={`tel:${biz.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                <Phone size={11}/> {biz.phone}
              </a>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-card">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To</div>
            <div className="font-bold text-slate-900 mt-0.5 leading-snug">{cust.name}</div>
            {cust.phone && (
              <a href={`https://wa.me/91${(cust.whatsapp || cust.phone).replace(/\D/g, '').replace(/^91/, '')}`} target="_blank" rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><MessageCircle size={11}/> {cust.phone}</a>
            )}
          </div>
        </div>

        {/* Invoice preview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="font-bold text-slate-900 text-sm">Invoice</div>
            <button onClick={downloadPng} className="text-[11px] font-bold uppercase tracking-wider text-brand-700 inline-flex items-center gap-1">
              <Download size={12}/> PNG
            </button>
          </div>
          <div className="p-5 overflow-hidden">
            <div className="flex justify-center">
              <div className="w-full max-w-[400px]">
                <div ref={invRef} className="invoice-render">
                  <div className="bg-white p-4 text-slate-900 border border-slate-200 rounded-2xl">
                    <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                      <div>
                        <div className="text-[15px] font-extrabold tracking-wide text-[#1e1b4b]">{biz.name.toUpperCase()}</div>
                        {biz.address && <div className="mt-0.5 text-[10px] leading-snug text-slate-500 whitespace-pre-line max-w-[180px]">{biz.address}</div>}
                        {biz.phone && <div className="mt-0.5 text-[10px] text-slate-500">📞 {biz.phone}</div>}
                      </div>
                      <div className="text-right">
                        <div className="inline-block rounded-md bg-[#1e1b4b] text-white text-[9px] font-bold px-2 py-0.5 tracking-wider">INVOICE</div>
                        <div className="mt-1.5 text-[12px] font-extrabold text-[#1e1b4b]">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-500">{formatDate(inv.invoiceDate)}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg p-3 bg-[#eef2ff] border border-[#e0e7ff]">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bill To</div>
                      <div className="mt-0.5 text-[12px] font-bold text-slate-800">{cust.name}</div>
                      {cust.phone && <div className="text-[10px] text-slate-500">📞 {cust.phone}</div>}
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-12 bg-[#1e1b4b] text-white text-[9px] font-bold uppercase tracking-wider">
                        <div className="col-span-6 px-2.5 py-1.5">Item</div>
                        <div className="col-span-2 px-2 py-1.5 text-center">Qty</div>
                        <div className="col-span-4 px-2 py-1.5 text-right">Total</div>
                      </div>
                      {items.map((it, idx) => (
                        <div key={it.id} className={clsx('grid grid-cols-12 text-[11px] items-center', idx % 2 ? 'bg-white' : 'bg-slate-50', idx !== items.length - 1 ? 'border-b border-slate-100' : '')}>
                          <div className="col-span-6 px-2.5 py-1.5 font-semibold text-slate-800 truncate">{it.name}</div>
                          <div className="col-span-2 px-2 py-1.5 text-center text-slate-600">×{it.quantity}</div>
                          <div className="col-span-4 px-2 py-1.5 text-right font-bold text-slate-800">{formatCurrency(it.lineTotal)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-lg bg-gradient-to-r from-[#1e1b4b] to-indigo-800 text-white p-3 flex items-center justify-between">
                      <div className="text-[10px] font-bold tracking-wider uppercase">Grand Total</div>
                      <div className="text-[16px] font-black">{formatCurrency(inv.grandTotal)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{formatCurrency(inv.subtotal)}</span></div>
              {inv.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-semibold text-rose-600">- {formatCurrency(inv.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="font-semibold">{formatCurrency(inv.gstAmount)}</span></div>
              <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between items-center">
                <span className="font-bold text-slate-800">Total</span>
                <span className="font-black text-lg text-slate-900">{formatCurrency(inv.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-400 pt-2 px-3">
          Powered by PS Enterprises · Secure UPI payment link · Thank you for your business 🙏
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl z-50 animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}

function setMeta(name: string, content: string, property = false) {
  try {
    const attr = property ? 'property' : 'name';
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  } catch { /* ignore */ }
}

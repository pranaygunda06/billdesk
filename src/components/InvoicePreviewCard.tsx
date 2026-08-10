import { forwardRef, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import type { BusinessProfile, Customer, Invoice, InvoiceItem } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { makeQrPngDataUrl, svgElementToPngDataUrl } from '../lib/qrPng';

interface Props {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
  business: BusinessProfile;
  /** Public customer-facing short URL — preferred content for the QR code */
  publicLink?: string;
}

/**
 * Printable invoice card. Uses system fonts + raster QR image
 * so html2canvas export never produces garbled text or blank QR.
 * Falls back to live SVG QR if PNG generation is slow/fails.
 */
const InvoicePreviewCard = forwardRef<HTMLDivElement, Props>(function InvoicePreviewCard(
  { invoice, items, customer, business, publicLink },
  ref,
) {
  const qrPayload =
    (publicLink && publicLink.trim()) ||
    buildUpiFallback(business, invoice);

  const [qrSrc, setQrSrc] = useState<string>('');
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const invDate = new Date(invoice.invoiceDate);
  const dueDate = new Date(invoice.dueDate);
  const isPaid = invoice.paymentStatus.toLowerCase() === 'paid';
  const font = 'Arial, Helvetica, sans-serif';

  useEffect(() => {
    let cancelled = false;
    setQrSrc('');
    if (!qrPayload) return;

    (async () => {
      // 1) Primary: offline/API PNG generator
      const url = await makeQrPngDataUrl(qrPayload, 220);
      if (!cancelled && url) {
        setQrSrc(url);
        return;
      }

      // 2) Fallback: convert the rendered react-qr-code SVG → PNG
      await new Promise((r) => setTimeout(r, 50));
      const svg = svgWrapRef.current?.querySelector('svg');
      if (svg && !cancelled) {
        try {
          const fromSvg = await svgElementToPngDataUrl(svg as SVGSVGElement, 220);
          if (!cancelled && fromSvg) setQrSrc(fromSvg);
        } catch (e) {
          console.warn('SVG→PNG QR fallback failed', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  return (
    <div
      ref={ref}
      className="invoice-render"
      style={{
        width: 480,
        background: '#ffffff',
        padding: 24,
        color: '#0f172a',
        fontFamily: font,
        letterSpacing: 'normal',
        boxSizing: 'border-box',
        lineHeight: 1.35,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingBottom: 16,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div style={{ maxWidth: 260 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e1b4b', fontFamily: font }}>
            {(business.name || 'Business').toUpperCase()}
          </div>
          {business.address && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#64748b', whiteSpace: 'pre-line', fontFamily: font }}>
              {business.address}
            </div>
          )}
          {business.phone && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#64748b', fontFamily: font }}>
              Ph: {business.phone}
            </div>
          )}
          {business.gstNumber && (
            <div style={{ marginTop: 2, fontSize: 11, color: '#64748b', fontFamily: font }}>
              GST: {business.gstNumber}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-block',
              background: '#1e1b4b',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 4,
              fontFamily: font,
            }}
          >
            TAX INVOICE
          </div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: '#1e1b4b', fontFamily: font }}>
            {invoice.invoiceNumber}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: font }}>Date: {formatDate(invDate)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: font }}>Due: {formatDate(dueDate)}</div>
        </div>
      </div>

      {/* Bill to */}
      <div
        style={{
          marginTop: 16,
          borderRadius: 8,
          padding: 12,
          background: '#eef2ff',
          border: '1px solid #e0e7ff',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontFamily: font }}>
          Bill To
        </div>
        <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: '#1e293b', fontFamily: font }}>
          {customer.name}
        </div>
        {customer.phone && (
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: font }}>Ph: {customer.phone}</div>
        )}
        {customer.address && (
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: font }}>{customer.address}</div>
        )}
        {customer.gstNumber && (
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: font }}>GST: {customer.gstNumber}</div>
        )}
      </div>

      {/* Items */}
      <div style={{ marginTop: 16, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 0.6fr 1fr 1.1fr',
            background: '#1e1b4b',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: font,
          }}
        >
          <div style={{ padding: '8px 10px' }}>ITEM</div>
          <div style={{ padding: '8px 6px', textAlign: 'center' }}>QTY</div>
          <div style={{ padding: '8px 6px', textAlign: 'right' }}>PRICE</div>
          <div style={{ padding: '8px 10px', textAlign: 'right' }}>TOTAL</div>
        </div>
        {items.map((it, idx) => (
          <div
            key={it.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2.2fr 0.6fr 1fr 1.1fr',
              fontSize: 11,
              fontFamily: font,
              background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
              borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9',
            }}
          >
            <div style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>{it.name}</div>
            <div style={{ padding: '8px 6px', textAlign: 'center', color: '#475569' }}>
              {Number.isInteger(it.quantity) ? it.quantity : it.quantity.toFixed(2)}
            </div>
            <div style={{ padding: '8px 6px', textAlign: 'right', color: '#475569' }}>
              {formatCurrency(it.unitPrice)}
            </div>
            <div style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
              {formatCurrency(it.lineTotal)}
            </div>
          </div>
        ))}
      </div>

      {/* QR + totals */}
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        <div
          style={{
            flex: 1,
            borderRadius: 10,
            padding: 12,
            background: '#ecfdf5',
            border: '1px solid #bbf7d0',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', fontFamily: font }}>
            Scan to view &amp; pay
          </div>
          <div
            style={{
              marginTop: 8,
              display: 'inline-block',
              padding: 6,
              background: '#fff',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              lineHeight: 0,
              minWidth: 110,
              minHeight: 110,
            }}
          >
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="Invoice QR"
                width={110}
                height={110}
                style={{ display: 'block', width: 110, height: 110 }}
                crossOrigin="anonymous"
              />
            ) : qrPayload ? (
              <div ref={svgWrapRef} style={{ width: 110, height: 110 }}>
                <QRCode value={qrPayload} size={110} fgColor="#1e1b4b" bgColor="#ffffff" />
              </div>
            ) : (
              <div
                style={{
                  width: 110,
                  height: 110,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#94a3b8',
                  fontFamily: font,
                }}
              >
                No link
              </div>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: '#047857', fontFamily: font }}>
            {formatCurrency(invoice.grandTotal)}
          </div>
          {publicLink ? (
            <div style={{ marginTop: 2, fontSize: 8, color: '#64748b', wordBreak: 'break-all', fontFamily: font }}>
              {publicLink.replace(/^https?:\/\//, '')}
            </div>
          ) : (
            <div style={{ marginTop: 2, fontSize: 9, color: '#64748b', fontFamily: font }}>
              {business.upiId || ''}
            </div>
          )}
        </div>

        <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <Row label="Subtotal" value={formatCurrency(invoice.subtotal)} font={font} />
            {invoice.discount > 0 && (
              <Row label="Discount" value={`- ${formatCurrency(invoice.discount)}`} font={font} negative />
            )}
            {invoice.gstAmount > 0 && (
              <Row label="GST" value={formatCurrency(invoice.gstAmount)} font={font} />
            )}
          </div>
          <div
            style={{
              marginTop: 8,
              borderRadius: 8,
              padding: 12,
              background: 'linear-gradient(135deg,#1e1b4b 0%,#3730a3 100%)',
              color: '#fff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, fontFamily: font }}>GRAND TOTAL</div>
            <div style={{ fontSize: 17, fontWeight: 800, fontFamily: font }}>{formatCurrency(invoice.grandTotal)}</div>
          </div>
          <div
            style={{
              marginTop: 8,
              borderRadius: 6,
              padding: '6px 0',
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              fontFamily: font,
              background: isPaid ? '#d1fae5' : '#fef3c7',
              color: isPaid ? '#047857' : '#b45309',
            }}
          >
            {isPaid
              ? 'PAID'
              : invoice.outstandingAmount > 0
                ? `OUTSTANDING ${formatCurrency(invoice.outstandingAmount)}`
                : 'PENDING'}
          </div>
        </div>
      </div>

      {(business.terms || business.invoiceFooter) && (
        <div
          style={{
            marginTop: 16,
            borderRadius: 8,
            padding: 12,
            background: '#f8fafc',
            border: '1px solid #f1f5f9',
          }}
        >
          {business.terms && (
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: font }}>
              <span style={{ fontWeight: 600 }}>Terms: </span>
              {business.terms}
            </div>
          )}
          {business.invoiceFooter && (
            <div style={{ marginTop: business.terms ? 4 : 0, fontSize: 11, fontWeight: 600, color: '#1e1b4b', fontFamily: font }}>
              {business.invoiceFooter}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 9, fontStyle: 'italic', color: '#94a3b8', fontFamily: font }}>
        This is a computer generated invoice. Signature not required.
      </div>
    </div>
  );
});

function Row({
  label,
  value,
  negative,
  font,
}: {
  label: string;
  value: string;
  negative?: boolean;
  font: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontFamily: font }}>
      <span style={{ color: negative ? '#e11d48' : '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 600, color: negative ? '#e11d48' : '#1e293b' }}>{value}</span>
    </div>
  );
}

function buildUpiFallback(business: BusinessProfile, invoice: Invoice): string {
  const upi = business.upiId || '';
  if (!upi) return '';
  const qs = new URLSearchParams();
  qs.set('pa', upi);
  qs.set('pn', business.name || 'Payee');
  qs.set('cu', 'INR');
  if (invoice.grandTotal > 0) qs.set('am', invoice.grandTotal.toFixed(2));
  qs.set('tn', `Invoice ${invoice.invoiceNumber}`);
  qs.set('tr', invoice.invoiceNumber);
  return `upi://pay?${qs.toString()}`;
}

export default InvoicePreviewCard;

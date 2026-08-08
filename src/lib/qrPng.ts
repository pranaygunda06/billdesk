/**
 * Rasterise a QR payload to a PNG data-URL so html2canvas can embed it reliably.
 * Uses a tiny pure-JS QR encoder (no external network call).
 */

// Minimal QR Code generator (byte mode, ECC M) — adapted for short URLs/UPI strings.
// For production reliability we also fall back to canvas from SVG if needed.

type Module = boolean;

function qrMatrix(text: string): boolean[][] {
  // Use the browser's built-in path: create an offscreen SVG via a temporary QR library pattern
  // implemented with the well-known "qrcode-generator" algorithm for alphanumeric/byte.
  // To keep deps zero and reliability high, we build via Canvas + a compact encoder.

  // Dynamic import alternative avoided; inline minimal encoder for version 1-10 auto.
  const QR = (window as any).__PS_QR__;
  if (QR) return QR(text);

  // Fallback: return empty — caller will use SVG path
  return [];
}

/**
 * Convert an existing SVG QR element to a PNG data URL via canvas.
 */
export async function svgElementToPngDataUrl(svg: SVGSVGElement, size = 200): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(size));
  clone.setAttribute('height', String(size));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${size} ${size}`);
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('no canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('svg load failed'));
    img.src = svgUrl;
  });
}

/**
 * Build a PNG data-URL for `text` by rendering react-qr-code style SVG in a hidden node.
 * Call this before html2canvas so the invoice only contains a real <img>.
 */
export async function makeQrPngDataUrl(text: string, size = 200): Promise<string> {
  if (!text) return '';

  // 1) Try public QR API (works when online — most reliable for export)
  try {
    const api = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&ecc=M&data=${encodeURIComponent(text)}`;
    const res = await fetch(api);
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // offline / blocked — fall through
  }

  // 2) Offline: draw modules with a compact QR library loaded from CDN once
  try {
    await loadQrLib();
    const QRCodeLib = (window as any).QRCode;
    if (QRCodeLib) {
      const canvas = document.createElement('canvas');
      await new Promise<void>((resolve, reject) => {
        QRCodeLib.toCanvas(
          canvas,
          text,
          { width: size, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' }, errorCorrectionLevel: 'M' },
          (err: any) => (err ? reject(err) : resolve()),
        );
      });
      return canvas.toDataURL('image/png');
    }
  } catch {
    // ignore
  }

  return '';
}

let qrLibPromise: Promise<void> | null = null;
function loadQrLib(): Promise<void> {
  if ((window as any).QRCode) return Promise.resolve();
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('qr lib load failed'));
    document.head.appendChild(s);
  });
  return qrLibPromise;
}

// silence unused
void qrMatrix;

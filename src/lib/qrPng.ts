/**
 * Build a PNG data-URL QR for invoice export.
 * Order: offline canvas (qrcode CDN) → external API → empty.
 */

let qrLibPromise: Promise<void> | null = null;

function loadQrLib(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).QRCode) return Promise.resolve();
  if (qrLibPromise) return qrLibPromise;
  qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('qr lib load failed'));
    document.head.appendChild(s);
  });
  return qrLibPromise;
}

async function fromQrLib(text: string, size: number): Promise<string> {
  await loadQrLib();
  const QRCodeLib = (window as any).QRCode;
  if (!QRCodeLib?.toCanvas) throw new Error('QRCode missing');
  const canvas = document.createElement('canvas');
  await new Promise<void>((resolve, reject) => {
    QRCodeLib.toCanvas(
      canvas,
      text,
      {
        width: size,
        margin: 2,
        color: { dark: '#1e1b4b', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      },
      (err: unknown) => (err ? reject(err) : resolve()),
    );
  });
  return canvas.toDataURL('image/png');
}

async function fromPublicApi(text: string, size: number): Promise<string> {
  const api = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&ecc=M&data=${encodeURIComponent(text)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('api fail');
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

export async function makeQrPngDataUrl(text: string, size = 200): Promise<string> {
  if (!text) return '';
  try {
    const url = await fromQrLib(text, size);
    if (url) return url;
  } catch (e) {
    console.warn('QR lib failed, trying API', e);
  }
  try {
    const url = await fromPublicApi(text, size);
    if (url) return url;
  } catch (e) {
    console.warn('QR API failed', e);
  }
  return '';
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | Date, pattern: string = 'dd MMM yyyy'): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '';
  const day = d.getDate().toString().padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  return pattern
    .replace('dd', day)
    .replace('MMM', mon)
    .replace('yyyy', year.toString());
}

export function generateId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 9999)}`;
}

export function invoiceNumber(prefix: string): string {
  const ts = Date.now().toString().slice(-8);
  return `${prefix}${ts}`;
}

export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function clsx(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ');
}

export interface SwapRestore {
  restore(): void;
}

/**
 * Replace every <canvas> and <svg> (QR codes) inside container with equivalent <img src=dataURL>.
 * html2canvas often fails on canvas/SVG; pre-rendering to PNG/SVG-data images makes invoice screenshots reliable.
 */
export function swapCanvasesToImages(container: HTMLElement): SwapRestore {
  const swaps: { el: HTMLElement; img: HTMLImageElement }[] = [];

  // 1) Canvas → img
  const canvases = Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas'));
  for (const canvas of canvases) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.width = (canvas.offsetWidth || canvas.width) + 'px';
      img.style.height = (canvas.offsetHeight || canvas.height) + 'px';
      img.style.display = 'block';
      img.alt = 'qr';
      const parent = canvas.parentNode;
      if (parent) parent.insertBefore(img, canvas);
      canvas.style.display = 'none';
      swaps.push({ el: canvas, img });
    } catch {
      // skip
    }
  }

  // 2) SVG (react-qr-code) → img via serialised SVG data URL
  const svgs = Array.from(container.querySelectorAll<SVGSVGElement>('svg'));
  for (const svg of svgs) {
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const w = svg.clientWidth || (svg.width && svg.width.baseVal ? svg.width.baseVal.value : 128) || 128;
      const h = svg.clientHeight || (svg.height && svg.height.baseVal ? svg.height.baseVal.value : 128) || 128;
      if (!clone.getAttribute('width')) clone.setAttribute('width', String(w));
      if (!clone.getAttribute('height')) clone.setAttribute('height', String(h));
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const xml = new XMLSerializer().serializeToString(clone);
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      const img = document.createElement('img');
      img.src = dataUrl;
      img.width = w;
      img.height = h;
      img.style.width = w + 'px';
      img.style.height = h + 'px';
      img.style.display = 'block';
      img.alt = 'qr';
      const parent = svg.parentNode;
      if (parent) parent.insertBefore(img, svg);
      (svg as unknown as HTMLElement).style.display = 'none';
      swaps.push({ el: svg as unknown as HTMLElement, img });
    } catch {
      // skip
    }
  }

  return {
    restore() {
      for (const s of swaps) {
        if (s.img.parentNode) s.img.parentNode.removeChild(s.img);
        s.el.style.display = '';
      }
    },
  };
}


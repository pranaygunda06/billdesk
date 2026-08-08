import { useEffect, useRef } from 'react';

/**
 * Listens for USB / Bluetooth barcode scanners (keyboard-wedge).
 * Scanners type characters very quickly and usually end with Enter.
 * When a rapid burst is detected, onScan is called with the code.
 * Slow human typing is ignored so normal search still works.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef('');
  const lastKeyAt = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const MAX_GAP_MS = 50; // keys within 50ms = scanner
    const MIN_LEN = 3;

    function flush() {
      const code = buffer.current.trim();
      buffer.current = '';
      if (code.length >= MIN_LEN) {
        onScanRef.current(code);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      // Ignore when user is typing in a normal text field (except our scan-aware ones)
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || (t as any)?.isContentEditable;
      const allowOnInput = t?.dataset?.barcode === 'true';

      if (isInput && !allowOnInput) {
        // still allow Enter flush if buffer has content from before focus
        if (e.key === 'Enter' && buffer.current.length >= MIN_LEN) {
          e.preventDefault();
          flush();
        }
        return;
      }

      const now = Date.now();
      const gap = now - lastKeyAt.current;
      lastKeyAt.current = now;

      if (e.key === 'Enter') {
        if (buffer.current.length >= MIN_LEN) {
          e.preventDefault();
          flush();
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // If gap is large, start a new buffer (human typing)
        if (gap > MAX_GAP_MS * 4) {
          buffer.current = '';
        }
        buffer.current += e.key;
        // Auto-flush if buffer is long and no more keys coming soon
        window.clearTimeout((onKeyDown as any)._t);
        (onKeyDown as any)._t = window.setTimeout(() => {
          if (buffer.current.length >= MIN_LEN && Date.now() - lastKeyAt.current >= MAX_GAP_MS) {
            flush();
          }
        }, MAX_GAP_MS + 10);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout((onKeyDown as any)._t);
    };
  }, [enabled]);
}

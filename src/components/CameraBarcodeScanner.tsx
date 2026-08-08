import { useEffect, useRef, useState } from 'react';
import { X, Camera, SwitchCamera, Flashlight } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

/**
 * Full-screen camera barcode / QR scanner using html5-qrcode.
 * Supports continuous scan, rear camera preferred, torch toggle when available.
 */
export default function CameraBarcodeScanner({ open, onClose, onScan, title = 'Scan Barcode' }: Props) {
  const regionId = useRef(`qr-reader-${Math.random().toString(36).slice(2, 9)}`).current;
  const scannerRef = useRef<any>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [camIndex, setCamIndex] = useState(0);
  const lastCodeRef = useRef('');
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setError('');
      setStarting(true);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        // List cameras – prefer back/environment
        let devices: { id: string; label: string }[] = [];
        try {
          const cams = await Html5Qrcode.getCameras();
          devices = cams.map((c: any) => ({ id: c.id, label: c.label || c.id }));
        } catch {
          devices = [];
        }
        if (cancelled) return;
        setCameras(devices);

        // Prefer rear camera
        let preferred = 0;
        const backIdx = devices.findIndex((d) =>
          /back|rear|environment|trás|arrière/i.test(d.label),
        );
        if (backIdx >= 0) preferred = backIdx;
        setCamIndex(preferred);

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        const cameraIdOrConfig =
          devices.length > 0
            ? devices[preferred].id
            : { facingMode: 'environment' };

        await scanner.start(
          cameraIdOrConfig,
          {
            fps: 12,
            qrbox: (viewW: number, viewH: number) => {
              const s = Math.min(viewW, viewH) * 0.72;
              return { width: s, height: s * 0.55 };
            },
            aspectRatio: 1.333,
            disableFlip: false,
          },
          (decoded: string) => {
            const now = Date.now();
            // Debounce same code for 1.5s
            if (decoded === lastCodeRef.current && now - lastAtRef.current < 1500) return;
            lastCodeRef.current = decoded;
            lastAtRef.current = now;
            try {
              navigator.vibrate?.(40);
            } catch {
              /* ignore */
            }
            onScanRef.current(decoded);
            // Keep open for continuous multi-item scanning on Billing
          },
          () => {
            /* ignore frame errors */
          },
        );
      } catch (e: any) {
        if (!cancelled) {
          const msg = String(e?.message || e || 'Camera error');
          if (/NotAllowed|Permission/i.test(msg)) {
            setError('Camera permission denied. Allow camera in browser settings and try again.');
          } else if (/NotFound|no camera/i.test(msg)) {
            setError('No camera found on this device.');
          } else {
            setError(msg);
          }
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, regionId]);

  async function switchCamera() {
    if (cameras.length < 2 || !scannerRef.current) return;
    const next = (camIndex + 1) % cameras.length;
    setCamIndex(next);
    setTorchOn(false);
    try {
      await scannerRef.current.stop();
      await scannerRef.current.start(
        cameras[next].id,
        {
          fps: 12,
          qrbox: (viewW: number, viewH: number) => {
            const s = Math.min(viewW, viewH) * 0.72;
            return { width: s, height: s * 0.55 };
          },
          aspectRatio: 1.333,
        },
        (decoded: string) => {
          const now = Date.now();
          if (decoded === lastCodeRef.current && now - lastAtRef.current < 1500) return;
          lastCodeRef.current = decoded;
          lastAtRef.current = now;
          try {
            navigator.vibrate?.(40);
          } catch {
            /* ignore */
          }
          onScanRef.current(decoded);
        },
        () => {},
      );
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function toggleTorch() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      const track = s.getRunningTrackCameraCapabilities?.();
      if (track?.torchFeature?.isSupported?.()) {
        const next = !torchOn;
        await track.torchFeature.apply(next);
        setTorchOn(next);
      } else {
        // Fallback via media stream
        const stream: MediaStream | undefined = s.getRunningTrackSettings
          ? undefined
          : undefined;
        void stream;
        setError('Torch not supported on this camera');
        setTimeout(() => setError(''), 2000);
      }
    } catch {
      setError('Torch not available');
      setTimeout(() => setError(''), 2000);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-emerald-400" />
          <span className="font-bold text-sm">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          aria-label="Close scanner"
        >
          <X size={20} />
        </button>
      </div>

      {/* Camera region */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        <div id={regionId} className="w-full max-w-lg mx-auto" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-medium">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 bg-rose-600 text-white text-sm font-semibold px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-4 bg-black/90 flex items-center justify-center gap-6 shrink-0 safe-bottom">
        {cameras.length > 1 && (
          <button
            onClick={switchCamera}
            className="flex flex-col items-center gap-1 text-white/90 hover:text-white"
          >
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
              <SwitchCamera size={22} />
            </div>
            <span className="text-[10px] font-semibold">Flip</span>
          </button>
        )}
        <button
          onClick={toggleTorch}
          className="flex flex-col items-center gap-1 text-white/90 hover:text-white"
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              torchOn ? 'bg-amber-400 text-black' : 'bg-white/15'
            }`}
          >
            <Flashlight size={22} />
          </div>
          <span className="text-[10px] font-semibold">Torch</span>
        </button>
        <button
          onClick={onClose}
          className="flex flex-col items-center gap-1 text-white/90 hover:text-white"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm">
            Done
          </div>
          <span className="text-[10px] font-semibold">Close</span>
        </button>
      </div>

      <p className="text-center text-[11px] text-white/50 pb-3 px-4">
        Point at barcode · keeps scanning for multiple items
      </p>
    </div>
  );
}

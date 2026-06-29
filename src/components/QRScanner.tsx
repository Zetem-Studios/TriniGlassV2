import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CameraOff, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

// Candados absolutos fuera del DOM y de React
let globalScannerInstance: Html5Qrcode | null = null;
let isScannerInitiating = false;

function friendlyCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  const message = typeof err === 'string' ? err : ((err as Error)?.message ?? '');
  if (name === 'NotAllowedError' || /permission|denied/i.test(message)) {
    return 'Permiso de cámara denegado. Habilítalo en los ajustes del navegador y reinténtalo.';
  }
  if (name === 'NotFoundError' || /no.*camera|not found/i.test(message)) {
    return 'No se ha encontrado ninguna cámara en el dispositivo.';
  }
  if (name === 'NotReadableError' || /in use|busy/i.test(message)) {
    return 'La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.';
  }
  return 'No se pudo iniciar la cámara. Comprueba los permisos e inténtalo de nuevo.';
}

const QRScanner = ({ onScanSuccess }: QRScannerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasScannedRef = useRef(false);
  // Guardamos el callback en un ref para no reiniciar la cámara en cada render del padre.
  const onScanSuccessRef = useRef(onScanSuccess);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    hasScannedRef.current = false;
    setCameraError(null);
    if (!wrapperRef.current) return;

    const currentWrapper = wrapperRef.current;

    // Evitamos el doble montaje de StrictMode
    if (isScannerInitiating) return;

    // Si había una instancia colgada en memoria, la matamos sin piedad
    if (globalScannerInstance) {
      if (globalScannerInstance.isScanning) {
        globalScannerInstance.stop().then(() => globalScannerInstance?.clear()).catch(() => {});
      } else {
        globalScannerInstance.clear();
      }
    }

    const uniqueId = "qr-" + Math.random().toString(36).substring(2, 9);
    const div = document.createElement("div");
    div.id = uniqueId;
    div.style.position = "relative";
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.overflow = "hidden";

    currentWrapper.innerHTML = "";
    currentWrapper.appendChild(div);

    globalScannerInstance = new Html5Qrcode(uniqueId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.CODE_93,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E
      ],
      useBarCodeDetectorIfSupported: true,
      verbose: false
    });
    isScannerInitiating = true;

    globalScannerInstance.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 280, height: 180 }
      },
      (text) => {
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;
        onScanSuccessRef.current(text);
        // Detener la cámara automáticamente tras el primer escaneo válido
        if (globalScannerInstance?.isScanning) {
          globalScannerInstance.stop().catch(() => {});
        }
      },
      () => {}
    ).catch((err) => {
      setCameraError(friendlyCameraError(err));
    }).finally(() => {
      isScannerInitiating = false;
    });

    return () => {
      // Al cerrar la ventana, cerramos el stream real de la cámara
      if (globalScannerInstance) {
        if (globalScannerInstance.isScanning) {
          globalScannerInstance.stop().then(() => globalScannerInstance?.clear()).catch(() => {});
        } else {
          globalScannerInstance.clear();
        }
      }
      isScannerInitiating = false;
      if (currentWrapper) currentWrapper.innerHTML = "";
    };
  }, [retryKey]);

  return (
    <div className="w-full max-w-sm mx-auto overflow-hidden bg-black rounded-xl shadow-lg ring-1 ring-white/10 relative">
      {/* INYECCIÓN CSS DRÁSTICA:
          Fuerza a toda costa que CUALQUIER elemento de vídeo o lienzo inyectado por la librería
          se posicione absolutamente uno encima del otro en la misma coordenada geométrica (top 0, left 0).
          Esto anula cualquier formato por defecto de Tailwind o iOS Safari que estuviera
          apilando las capas en formato vertical bloque. */}
      <style>{`
        div[id^="qr-"] video, div[id^="qr-"] canvas {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>

      <div ref={wrapperRef} className="w-full h-[400px] bg-black relative"></div>

      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-center px-6">
          <CameraOff className="w-10 h-10 text-red-400" />
          <p className="text-sm text-slate-200 max-w-xs">{cameraError}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;

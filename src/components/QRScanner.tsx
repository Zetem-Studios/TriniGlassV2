import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

// Candados absolutos fuera del DOM y de React
let globalScannerInstance: Html5Qrcode | null = null;
let isScannerInitiating = false;

const QRScanner = ({ onScanSuccess }: QRScannerProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    hasScannedRef.current = false;
    if (!wrapperRef.current) return;
    
    const currentWrapper = wrapperRef.current;
    
    // Evitamos el doble montaje de StrictMode 
    if (isScannerInitiating) return;

    // Si había una instancia colgada en memoria, la matamos sin piedad
    if (globalScannerInstance) {
      if (globalScannerInstance.isScanning) {
        globalScannerInstance.stop().then(() => globalScannerInstance?.clear()).catch(()=>{});
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

    globalScannerInstance = new Html5Qrcode(uniqueId);
    isScannerInitiating = true;

    globalScannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (text) => {
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;
        onScanSuccess(text);
        // Detener la cámara automáticamente tras el primer escaneo válido
        if (globalScannerInstance?.isScanning) {
          globalScannerInstance.stop().catch(() => {});
        }
      },
      () => {}
    ).catch(() => {}).finally(() => {
      isScannerInitiating = false;
    });

    return () => {
      // Al cerrar la ventana, cerramos el stream real de la cámara
      if (globalScannerInstance) {
        if (globalScannerInstance.isScanning) {
          globalScannerInstance.stop().then(() => globalScannerInstance?.clear()).catch(()=>{});
        } else {
          globalScannerInstance.clear();
        }
      }
      isScannerInitiating = false;
      if (currentWrapper) currentWrapper.innerHTML = "";
    };
  }, [onScanSuccess]);

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
    </div>
  );
};

export default QRScanner;

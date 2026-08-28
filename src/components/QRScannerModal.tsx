"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { parseQRCodeText } from "@/lib/qrParser";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  description?: string;
}

export default function QRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = "Pindai QR Code Santri",
  description = "Arahkan kamera ke QR Code pada Kartu Santri (KTS)",
}: QRScannerModalProps) {
  const [errorMsg, setErrorMsg] = useState("");
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setErrorMsg("");
    setIsStarting(true);

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("sips-qr-reader-region");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              // Bersihkan dan ekstrak payload mentah ke NIS/ID murni
              const { searchKey } = parseQRCodeText(decodedText);
              onScanSuccess(searchKey);
              stopScanner();
            }
          },
          () => {
            // frame callback ignore
          }
        );

        if (isMounted) setIsStarting(false);
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || "Gagal mengakses kamera. Pastikan izin kamera aktif.");
          setIsStarting(false);
        }
      }
    };

    // Beri jeda kecil agar elemen DOM render terlebih dahulu
    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Stop scanner warning:", e);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl text-white p-6 space-y-4">
        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[10px] text-slate-400">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Scanner */}
        <div className="relative overflow-hidden rounded-2xl bg-black border border-slate-800 aspect-square flex items-center justify-center">
          <div id="sips-qr-reader-region" className="w-full h-full" />

          {isStarting && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center space-y-2 z-10">
              <RefreshCw className="h-7 w-7 animate-spin text-cyan-400" />
              <p className="text-xs font-semibold text-slate-400">Menghubungkan sensor kamera...</p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-2 z-10">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="text-xs font-semibold text-rose-300">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Petunjuk */}
        <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>Dekatkan QR Code santri ke dalam kotak pemindai untuk autofill instan.</span>
        </div>
      </div>
    </div>
  );
}
"use client";

import QrScanner from "qr-scanner";
import { useEffect, useRef, useState } from "react";

/** 登機口的 QR 掃描視窗（用手機鏡頭掃乘客的登機證） */
export function QrScan({ active, onScan }: { active: boolean; onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;
    setError(null);
    const scanner = new QrScanner(video, (result) => callbackRef.current(result.data), {
      returnDetailedScanResult: true,
      highlightScanRegion: true,
      maxScansPerSecond: 4,
      preferredCamera: "environment",
    });
    scanner.start().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [active]);

  if (!active) {
    return (
      <div className="panel flex aspect-video items-center justify-center">
        <span className="text-dim text-xs tracking-[0.35em]">CAMERA STANDBY · 相機待命</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-seam bg-black">
      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-night/85 p-4 text-center text-xs leading-relaxed text-bad">
          相機無法啟動（{error}）。
          <br />
          請確認瀏覽器的相機權限，或改用下方名單手動報到。
        </div>
      )}
    </div>
  );
}

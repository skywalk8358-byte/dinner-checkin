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
      <div className="card flex aspect-video items-center justify-center">
        <span className="text-sub text-[14px]">📷 相機待命中</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-black">
      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-[13px] leading-relaxed text-white">
          相機無法啟動（{error}）。
          <br />
          請確認瀏覽器的相機權限，或改用旁邊的名單手動報到。
        </div>
      )}
    </div>
  );
}

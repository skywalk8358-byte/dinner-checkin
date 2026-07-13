"use client";

import { useNow } from "@/lib/client";

const pad = (n: number) => String(n).padStart(2, "0");

export function Clock() {
  const ms = useNow(1000);
  const now = ms ? new Date(ms) : null;

  return (
    <div className="text-right leading-tight">
      <div className="glow-text text-lg font-semibold tracking-widest sm:text-xl">
        {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : "--:--:--"}
      </div>
      <div className="text-dim text-[10px] tracking-[0.3em] sm:text-xs">
        {now ? `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} LOCAL TIME` : "LOCAL TIME"}
      </div>
    </div>
  );
}

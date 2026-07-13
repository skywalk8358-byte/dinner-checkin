"use client";

import Link from "next/link";
import { Clock } from "./Clock";
import { Flap } from "./SplitFlap";

/** 每頁共用的看板頁首：航空公司 LOGO + 即時時鐘 */
export function BoardHeader({ sub }: { sub?: string }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4 border-b border-seam pb-4">
      <div>
        <Link href="/" className="group inline-flex items-baseline gap-2">
          <span className="glow-text text-2xl font-bold tracking-[0.18em] sm:text-3xl">
            ✈ DINNER<span className="text-glow-soft">AIR</span>
          </span>
        </Link>
        <div className="text-dim mt-1 text-[10px] tracking-[0.35em] sm:text-xs">
          {sub ?? "DINNER CHECK-IN SYSTEM · 聚餐報名系統"}
        </div>
      </div>
      <Clock />
    </header>
  );
}

export function BoardShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-screen px-4 py-6 sm:px-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
      {children}
    </main>
  );
}

export function SectionTitle({ en, zh }: { en: string; zh: string }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-3">
      <Flap text={en} className="text-sm font-semibold sm:text-base" />
      <span className="text-dim text-xs tracking-[0.3em]">{zh}</span>
    </h2>
  );
}

export function NotFoundBoard({ message, backHref = "/", backLabel = "返回航班看板" }: {
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
      <Flap text="NOT FOUND" className="text-2xl font-bold text-bad" />
      <p className="text-dim text-sm">{message}</p>
      <Link href={backHref} className="btn btn-ghost text-xs">
        ← {backLabel}
      </Link>
    </div>
  );
}

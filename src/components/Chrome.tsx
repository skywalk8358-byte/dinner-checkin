"use client";

import Link from "next/link";

/** 每頁共用的頁首：極簡 wordmark + 頁面說明 */
export function BoardHeader({ sub }: { sub?: string }) {
  return (
    <header className="mb-6 flex items-center justify-between pt-2">
      <Link href="/" className="text-[17px] font-bold tracking-tight">
        <span className="text-accent">✈</span> Dinner Air
      </Link>
      <span className="text-sub max-w-[60%] truncate text-[13px]">{sub ?? "聚餐報名"}</span>
    </header>
  );
}

export function BoardShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto min-h-screen px-4 pb-10 pt-4 sm:px-6 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
      {children}
    </main>
  );
}

export function SectionTitle({ en, zh }: { en: string; zh: string }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2">
      <span className="text-[20px] font-bold">{zh}</span>
      <span className="text-sub text-[12px] font-medium tracking-wide">{en}</span>
    </h2>
  );
}

export function Loading() {
  return <div className="card text-sub px-4 py-12 text-center text-[14px]">載入中…</div>;
}

export function NotFoundBoard({ message, backHref = "/", backLabel = "返回航班列表" }: {
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-4 px-6 py-14 text-center">
      <span className="text-[40px]">🛫</span>
      <p className="text-[17px] font-semibold">找不到這個頁面</p>
      <p className="text-sub -mt-2 text-[14px]">{message}</p>
      <Link href={backHref} className="btn btn-secondary text-[14px]">
        ← {backLabel}
      </Link>
    </div>
  );
}

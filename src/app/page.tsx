"use client";

import Link from "next/link";
import { BoardHeader, BoardShell, Loading } from "@/components/Chrome";
import { useNow } from "@/lib/client";
import { fmtDateShort, fmtTime } from "@/lib/format";
import { confirmedOf, useDB, useHydrated } from "@/lib/store";
import { flightCapacity, flightPhase, PHASE_LABEL } from "@/lib/types";

const TONE_PILL = { ok: "pill-ok", warn: "pill-warn", bad: "pill-bad", dim: "pill-dim" } as const;

/** 航班列表（首頁） */
export default function DeparturesPage() {
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(15_000); // 狀態 15 秒刷新一次就夠

  const flights = [...db.flights].sort((a, b) => {
    const aPast = new Date(a.departAt).getTime() < now;
    const bPast = new Date(b.departAt).getTime() < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return new Date(a.departAt).getTime() - new Date(b.departAt).getTime();
  });

  return (
    <BoardShell>
      <BoardHeader />

      <h1 className="text-[28px] font-bold tracking-tight">出發航班</h1>
      <p className="text-sub mt-1 text-[14px]">選擇要參加的聚餐，開始報名</p>

      <div className="mt-5 flex flex-col gap-3">
        {!hydrated ? (
          <Loading />
        ) : flights.length === 0 ? (
          <div className="card text-sub px-4 py-12 text-center text-[14px]">
            目前沒有活動——到{" "}
            <Link href="/admin" className="text-accent font-medium">
              主辦人後台
            </Link>{" "}
            開一場吧
          </div>
        ) : (
          flights.map((f) => {
            const confirmed = confirmedOf(db, f.id).length;
            const cap = flightCapacity(f);
            const phase = flightPhase(f, confirmed, new Date(now));
            const label = PHASE_LABEL[phase];
            return (
              <Link
                key={f.id}
                href={`/flight/${f.code}`}
                className={`card flex items-center gap-4 px-5 py-4 transition hover:shadow-lg ${
                  phase === "departed" ? "opacity-55" : ""
                }`}
              >
                <div className="w-[64px] shrink-0 text-center">
                  <div className="text-[21px] font-bold tabular-nums leading-tight">{fmtTime(f.departAt)}</div>
                  <div className="text-sub mt-0.5 text-[12px]">{fmtDateShort(f.departAt)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{f.title}</div>
                  <div className="text-sub mt-0.5 truncate text-[13px]">
                    {f.code} · {f.venueName}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`pill ${TONE_PILL[label.tone]}`}>{label.zh}</span>
                  <span className="text-sub text-[12px] tabular-nums">
                    {confirmed}/{cap}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <footer className="text-sub mt-8 flex items-center justify-between text-[12px]">
        <span>示範模式 · 資料暫存於此瀏覽器</span>
        <Link href="/admin" className="text-accent font-medium">
          主辦人後台 →
        </Link>
      </footer>
    </BoardShell>
  );
}

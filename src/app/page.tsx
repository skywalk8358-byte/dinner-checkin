"use client";

import Link from "next/link";
import { BoardHeader, BoardShell } from "@/components/Chrome";
import { Flap } from "@/components/SplitFlap";
import { useNow } from "@/lib/client";
import { fmtDate, fmtTime } from "@/lib/format";
import { confirmedOf, useDB, useHydrated } from "@/lib/store";
import { flightCapacity, flightPhase, PHASE_LABEL } from "@/lib/types";

const TONE_CLASS = { ok: "text-ok", warn: "text-warn", bad: "text-bad", dim: "text-dim" } as const;

const ROW_GRID =
  "grid grid-cols-[58px_92px_1fr_96px] gap-2 sm:grid-cols-[72px_110px_1fr_110px_84px_170px]";

/** 出發航班看板（首頁） */
export default function DeparturesPage() {
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(15_000); // 看板狀態 15 秒刷新一次就夠

  const flights = [...db.flights].sort((a, b) => {
    const aPast = new Date(a.departAt).getTime() < now;
    const bPast = new Date(b.departAt).getTime() < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return new Date(a.departAt).getTime() - new Date(b.departAt).getTime();
  });

  return (
    <BoardShell>
      <BoardHeader />

      <div className="mb-4 flex items-baseline justify-between">
        <Flap text="DEPARTURES" className="text-xl font-bold sm:text-2xl" />
        <span className="text-dim text-[11px] tracking-[0.35em] sm:text-xs">出發航班 · 點選報名</span>
      </div>

      <div className="panel overflow-hidden">
        <div className={`${ROW_GRID} border-b border-seam px-4 py-2.5 text-[10px] tracking-[0.25em] text-dim sm:text-xs`}>
          <span>TIME</span>
          <span>FLIGHT</span>
          <span>DESTINATION 目的地</span>
          <span className="hidden sm:block">GATE</span>
          <span className="hidden sm:block">SEATS</span>
          <span className="text-right sm:text-left">STATUS</span>
        </div>

        {!hydrated ? (
          <div className="text-dim px-4 py-12 text-center text-xs tracking-[0.35em]">LOADING…</div>
        ) : flights.length === 0 ? (
          <div className="text-dim px-4 py-12 text-center text-sm">
            目前沒有航班——到{" "}
            <Link href="/admin" className="text-glow underline">
              主辦人後台
            </Link>{" "}
            開一班吧
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
                className={`${ROW_GRID} items-center border-b border-seam/50 px-4 py-3 transition last:border-b-0 hover:bg-tile ${
                  phase === "departed" ? "opacity-40" : ""
                }`}
              >
                <Flap text={fmtTime(f.departAt)} className="text-sm font-semibold" />
                <Flap text={f.code} className="text-sm font-semibold" />
                <div className="min-w-0">
                  <Flap text={f.venueName} className="text-sm font-semibold" />
                  <div className="text-dim mt-1 truncate text-[11px] tracking-wider">
                    {f.title} · {fmtDate(f.departAt)}
                  </div>
                </div>
                <span className="hidden text-sm sm:block">{f.gate.split(" ")[0]}</span>
                <span className="hidden text-sm sm:block">
                  {confirmed}/{cap}
                </span>
                <span
                  className={`text-right text-[11px] font-bold tracking-widest sm:text-left sm:text-xs ${TONE_CLASS[label.tone]} ${
                    phase === "boarding" ? "blink" : ""
                  }`}
                >
                  {label.en}
                  <span className="ml-1.5 hidden lg:inline">{label.zh}</span>
                </span>
              </Link>
            );
          })
        )}
      </div>

      <footer className="text-dim mt-6 flex items-center justify-between text-[10px] tracking-[0.25em] sm:text-[11px]">
        <span>DEMO MODE · 資料暫存於此瀏覽器</span>
        <Link href="/admin" className="transition hover:text-glow">
          CREW ONLY · 主辦人後台 →
        </Link>
      </footer>
    </BoardShell>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { BoardHeader, BoardShell, NotFoundBoard } from "@/components/Chrome";
import { Flap } from "@/components/SplitFlap";
import { fmtDate, fmtTime } from "@/lib/format";
import {
  cancelAttendee,
  confirmedOf,
  flightByCode,
  promoteStandby,
  setBoarded,
  setFlightStatus,
  standbyOf,
  useDB,
  useHydrated,
} from "@/lib/store";
import type { Attendee, Flight } from "@/lib/types";
import { flightCapacity, MEAL_LABEL, splitSeat } from "@/lib/types";

function seatCompare(a?: string, b?: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const sa = splitSeat(a);
  const sb = splitSeat(b);
  const ta = parseInt(sa.table, 10) || 0;
  const tb = parseInt(sb.table, 10) || 0;
  return ta - tb || sa.letter.localeCompare(sb.letter);
}

function StatTile({ label, zh, value, tone = "" }: { label: string; zh: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-tile px-4 py-3">
      <div className="text-dim text-[10px] tracking-[0.25em]">
        {label} <span className="ml-1">{zh}</span>
      </div>
      <Flap text={value} className={`mt-1.5 text-lg font-bold ${tone}`} />
    </div>
  );
}

function exportCsv(flight: Flight, attendees: Attendee[]) {
  const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const rows = [
    ["姓名", "部門", "座位", "餐點", "忌口備註", "狀態", "已報到", "報到時間", "票號", "報名時間"],
    ...attendees.map((a) => [
      a.name,
      a.dept ?? "",
      a.seat ?? "",
      MEAL_LABEL[a.meal].zh,
      a.mealNote ?? "",
      a.status === "confirmed" ? "確認" : "候補",
      a.checkedInAt ? "是" : "否",
      a.checkedInAt ? `${fmtDate(a.checkedInAt)} ${fmtTime(a.checkedInAt)}` : "",
      a.passToken,
      `${fmtDate(a.createdAt)} ${fmtTime(a.createdAt)}`,
    ]),
  ];
  // ﻿ = UTF-8 BOM，讓 Excel 正確認出中文
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${flight.code}-passengers.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** 乘客名單（Manifest）：主辦人看報名狀況、管理名單 */
export default function ManifestPage() {
  const { code } = useParams<{ code: string }>();
  const db = useDB();
  const hydrated = useHydrated();
  const [copied, setCopied] = useState(false);

  return (
    <BoardShell wide>
      <BoardHeader sub="PASSENGER MANIFEST · 乘客名單" />
      <AdminGate>
        {!hydrated ? (
          <div className="text-dim py-12 text-center text-xs tracking-[0.35em]">LOADING…</div>
        ) : (
          (() => {
            const flight = flightByCode(db, decodeURIComponent(code));
            if (!flight) return <NotFoundBoard message={`找不到航班 ${decodeURIComponent(code)}`} backHref="/admin" backLabel="返回後台" />;

            const confirmed = [...confirmedOf(db, flight.id)].sort((x, y) => seatCompare(x.seat, y.seat));
            const standby = standbyOf(db, flight.id);
            const boarded = confirmed.filter((a) => a.checkedInAt).length;
            const cap = flightCapacity(flight);
            const hasSpace = confirmed.length < cap;
            const mealCount = (key: Attendee["meal"]) => confirmed.filter((a) => a.meal === key).length;

            const copySignup = async () => {
              try {
                await navigator.clipboard.writeText(`${window.location.origin}/flight/${flight.code}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {}
            };

            const row = (a: Attendee, isStandby: boolean) => (
              <div
                key={a.id}
                className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-seam/40 px-4 py-2.5 last:border-b-0 sm:grid-cols-[64px_1.2fr_1fr_1fr_auto]"
              >
                <span className={`text-base font-bold ${isStandby ? "text-warn" : "glow-text"}`}>
                  {a.seat ?? (isStandby ? "STBY" : "—")}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {a.name}
                    {a.dept && <span className="text-dim ml-2 text-xs font-normal">{a.dept}</span>}
                  </div>
                  <div className="text-dim text-[11px] sm:hidden">
                    {MEAL_LABEL[a.meal].zh}
                    {a.mealNote && ` · ${a.mealNote}`}
                  </div>
                </div>
                <div className="text-dim hidden min-w-0 truncate text-xs sm:block">
                  {MEAL_LABEL[a.meal].zh}
                  {a.mealNote && <span className="ml-1 text-warn">({a.mealNote})</span>}
                </div>
                <div className="hidden text-xs sm:block">
                  {a.checkedInAt ? (
                    <span className="text-ok">✓ 已登機 {fmtTime(a.checkedInAt)}</span>
                  ) : isStandby ? (
                    <span className="text-warn">候補中</span>
                  ) : (
                    <span className="text-dim">未報到</span>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {isStandby ? (
                    <button
                      onClick={() => promoteStandby(a.id)}
                      disabled={!hasSpace}
                      title={hasSpace ? "遞補為正取" : "目前沒有空位"}
                      className="btn btn-ghost px-2.5 py-1 text-[11px]"
                    >
                      遞補
                    </button>
                  ) : (
                    <button
                      onClick={() => setBoarded(a.id, !a.checkedInAt)}
                      className={`btn px-2.5 py-1 text-[11px] ${a.checkedInAt ? "btn-ghost" : "btn-primary"}`}
                    >
                      {a.checkedInAt ? "取消報到" : "報到"}
                    </button>
                  )}
                  <Link href={`/pass/${a.passToken}`} target="_blank" className="btn btn-ghost px-2.5 py-1 text-[11px]">
                    票
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm(`確定取消 ${a.name} 的報名？`)) cancelAttendee(a.id);
                    }}
                    className="btn btn-danger px-2.5 py-1 text-[11px]"
                  >
                    取消
                  </button>
                </div>
              </div>
            );

            return (
              <>
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <Flap text={flight.code} className="text-xl font-bold" />
                    <span className="text-sm">{flight.title}</span>
                    <span className="text-dim text-xs">
                      {fmtDate(flight.departAt)} {fmtTime(flight.departAt)} · {flight.venueName}
                    </span>
                  </div>
                  <Link href="/admin" className="text-dim text-xs tracking-widest hover:text-glow">
                    ← 後台首頁
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="CONFIRMED" zh="正取" value={`${confirmed.length}/${cap}`} />
                  <StatTile label="STANDBY" zh="候補" value={String(standby.length)} tone={standby.length ? "text-warn" : ""} />
                  <StatTile
                    label="BOARDED"
                    zh="已登機"
                    value={`${boarded} (${confirmed.length ? Math.round((boarded / confirmed.length) * 100) : 0}%)`}
                    tone="text-ok"
                  />
                  <StatTile
                    label="MEALS"
                    zh="葷/素/特"
                    value={`${mealCount("standard")}/${mealCount("veg")}/${mealCount("special")}`}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={copySignup} className="btn btn-ghost px-3 py-1.5 text-xs">
                    {copied ? "✓ 已複製" : "🔗 複製報名連結"}
                  </button>
                  <Link href={`/admin/${flight.code}/boarding`} className="btn btn-primary px-3 py-1.5 text-xs">
                    ▶ BOARDING MODE · 登機口
                  </Link>
                  <button onClick={() => exportCsv(flight, [...confirmed, ...standby])} className="btn btn-ghost px-3 py-1.5 text-xs">
                    ⬇ 匯出 CSV
                  </button>
                  <button
                    onClick={() => setFlightStatus(flight.id, flight.status === "open" ? "closed" : "open")}
                    className={`btn px-3 py-1.5 text-xs ${flight.status === "open" ? "btn-danger" : "btn-ghost"}`}
                  >
                    {flight.status === "open" ? "截止報名" : "重新開放"}
                  </button>
                </div>

                <div className="panel mt-5 overflow-hidden">
                  <div className="text-dim border-b border-seam px-4 py-2 text-[10px] tracking-[0.25em]">
                    CONFIRMED · 正取名單（依座位排序）
                  </div>
                  {confirmed.length === 0 ? (
                    <div className="text-dim px-4 py-8 text-center text-sm">還沒有人報名</div>
                  ) : (
                    confirmed.map((a) => row(a, false))
                  )}
                </div>

                {standby.length > 0 && (
                  <div className="panel mt-4 overflow-hidden border-warn/30">
                    <div className="text-warn border-b border-seam px-4 py-2 text-[10px] tracking-[0.25em]">
                      STANDBY · 候補名單（依報名順序）
                    </div>
                    {standby.map((a) => row(a, true))}
                  </div>
                )}
              </>
            );
          })()
        )}
      </AdminGate>
    </BoardShell>
  );
}

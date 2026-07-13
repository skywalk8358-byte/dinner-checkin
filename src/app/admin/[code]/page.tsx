"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
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

function StatTile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-sub text-[12px] font-medium">{label}</div>
      <div className={`mt-1 text-[20px] font-bold tabular-nums ${tone}`}>{value}</div>
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
      <BoardHeader sub="乘客名單" />
      <AdminGate>
        {!hydrated ? (
          <Loading />
        ) : (
          (() => {
            const flight = flightByCode(db, decodeURIComponent(code));
            if (!flight) return <NotFoundBoard message={`找不到活動 ${decodeURIComponent(code)}`} backHref="/admin" backLabel="返回後台" />;

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
                className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-t border-line px-4 py-3 first:border-t-0 sm:grid-cols-[60px_1.2fr_1fr_1fr_auto]"
              >
                <span className={`text-[15px] font-bold tabular-nums ${isStandby ? "text-warn-deep" : "text-accent"}`}>
                  {a.seat ?? (isStandby ? "候補" : "—")}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">
                    {a.name}
                    {a.dept && <span className="text-sub ml-2 text-[12px] font-normal">{a.dept}</span>}
                  </div>
                  <div className="text-sub text-[12px] sm:hidden">
                    {MEAL_LABEL[a.meal].zh}
                    {a.mealNote && ` · ${a.mealNote}`}
                  </div>
                </div>
                <div className="text-sub hidden min-w-0 truncate text-[13px] sm:block">
                  {MEAL_LABEL[a.meal].zh}
                  {a.mealNote && <span className="text-warn-deep ml-1">({a.mealNote})</span>}
                </div>
                <div className="hidden text-[13px] sm:block">
                  {a.checkedInAt ? (
                    <span className="text-ok-deep">✓ 已報到 {fmtTime(a.checkedInAt)}</span>
                  ) : isStandby ? (
                    <span className="text-warn-deep">候補中</span>
                  ) : (
                    <span className="text-sub">未報到</span>
                  )}
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {isStandby ? (
                    <button
                      onClick={() => promoteStandby(a.id)}
                      disabled={!hasSpace}
                      title={hasSpace ? "遞補為正取" : "目前沒有空位"}
                      className="btn btn-secondary px-3 py-1.5 text-[12px]"
                    >
                      遞補
                    </button>
                  ) : (
                    <button
                      onClick={() => setBoarded(a.id, !a.checkedInAt)}
                      className={`btn px-3 py-1.5 text-[12px] ${a.checkedInAt ? "btn-secondary" : "btn-primary"}`}
                    >
                      {a.checkedInAt ? "取消報到" : "報到"}
                    </button>
                  )}
                  <Link href={`/pass/${a.passToken}`} target="_blank" className="btn btn-secondary px-3 py-1.5 text-[12px]">
                    票
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm(`確定取消 ${a.name} 的報名？`)) cancelAttendee(a.id);
                    }}
                    className="btn btn-danger px-3 py-1.5 text-[12px]"
                  >
                    取消
                  </button>
                </div>
              </div>
            );

            return (
              <>
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <h1 className="text-[22px] font-bold tracking-tight">{flight.title}</h1>
                    <span className="text-sub text-[13px]">
                      {flight.code} · {fmtDate(flight.departAt)} {fmtTime(flight.departAt)} · {flight.venueName}
                    </span>
                  </div>
                  <Link href="/admin" className="text-accent text-[13px] font-medium">
                    ← 後台首頁
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="正取" value={`${confirmed.length}/${cap}`} />
                  <StatTile label="候補" value={String(standby.length)} tone={standby.length ? "text-warn-deep" : ""} />
                  <StatTile
                    label="已報到"
                    value={`${boarded} (${confirmed.length ? Math.round((boarded / confirmed.length) * 100) : 0}%)`}
                    tone="text-ok-deep"
                  />
                  <StatTile label="葷 / 素 / 特殊" value={`${mealCount("standard")} / ${mealCount("veg")} / ${mealCount("special")}`} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={copySignup} className="btn btn-secondary px-3.5 py-2 text-[13px]">
                    {copied ? "✓ 已複製" : "複製報名連結"}
                  </button>
                  <Link href={`/admin/${flight.code}/boarding`} className="btn btn-primary px-3.5 py-2 text-[13px]">
                    登機口模式
                  </Link>
                  <button onClick={() => exportCsv(flight, [...confirmed, ...standby])} className="btn btn-secondary px-3.5 py-2 text-[13px]">
                    匯出 CSV
                  </button>
                  <button
                    onClick={() => setFlightStatus(flight.id, flight.status === "open" ? "closed" : "open")}
                    className={`btn px-3.5 py-2 text-[13px] ${flight.status === "open" ? "btn-danger" : "btn-secondary"}`}
                  >
                    {flight.status === "open" ? "截止報名" : "重新開放"}
                  </button>
                </div>

                <div className="card mt-5 overflow-hidden">
                  <div className="text-sub border-b border-line px-4 py-2.5 text-[12px] font-medium">
                    正取名單（依座位排序）
                  </div>
                  {confirmed.length === 0 ? (
                    <div className="text-sub px-4 py-10 text-center text-[14px]">還沒有人報名</div>
                  ) : (
                    confirmed.map((a) => row(a, false))
                  )}
                </div>

                {standby.length > 0 && (
                  <div className="card mt-4 overflow-hidden">
                    <div className="text-warn-deep border-b border-line px-4 py-2.5 text-[12px] font-medium">
                      候補名單（依報名順序）
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

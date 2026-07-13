"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
import { QrScan } from "@/components/QrScan";
import { fmtTime } from "@/lib/format";
import {
  checkInByToken,
  confirmedOf,
  flightByCode,
  setBoarded,
  standbyOf,
  useDB,
  useHydrated,
  type ScanResult,
} from "@/lib/store";

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = ok ? 880 : 200;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.28));
    osc.onended = () => void ctx.close();
  } catch {}
}

const FLASH_STYLE: Record<ScanResult["kind"], { cls: string; icon: string; title: string; sub: string }> = {
  ok: { cls: "tint-ok", icon: "✓", title: "歡迎登機", sub: "報到完成" },
  already: { cls: "tint-warn", icon: "！", title: "已經報到過了", sub: "這張登機證稍早已完成報到" },
  standby: { cls: "tint-warn", icon: "！", title: "候補票", sub: "請洽主辦人遞補後再報到" },
  "wrong-flight": { cls: "tint-bad", icon: "✕", title: "不是本場活動", sub: "這張登機證屬於其他活動" },
  invalid: { cls: "tint-bad", icon: "✕", title: "無效的登機證", sub: "查無此票，請確認 QR CODE" },
};

/** 登機口：QR 掃描報到 + 手動名單備援 */
export default function BoardingPage() {
  const { code } = useParams<{ code: string }>();
  const db = useDB();
  const hydrated = useHydrated();

  const [cameraOn, setCameraOn] = useState(false);
  const [flash, setFlash] = useState<ScanResult | null>(null);
  const [query, setQuery] = useState("");
  const lastScan = useRef({ token: "", at: 0 });

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <BoardShell wide>
      <BoardHeader sub="登機口" />
      <AdminGate>
        {!hydrated ? (
          <Loading />
        ) : (
          (() => {
            const flight = flightByCode(db, decodeURIComponent(code));
            if (!flight) return <NotFoundBoard message={`找不到活動 ${decodeURIComponent(code)}`} backHref="/admin" backLabel="返回後台" />;

            const confirmed = confirmedOf(db, flight.id);
            const boarded = confirmed.filter((a) => a.checkedInAt);
            const standbyCount = standbyOf(db, flight.id).length;

            const onScan = (text: string) => {
              const token = text.trim().split("/").filter(Boolean).pop() ?? "";
              if (!token) return;
              const now = Date.now();
              // 同一張票 2.5 秒內重複入鏡不重複觸發
              if (token === lastScan.current.token && now - lastScan.current.at < 2500) return;
              lastScan.current = { token, at: now };
              const result = checkInByToken(token, flight.id);
              setFlash(result);
              beep(result.kind === "ok");
            };

            const list = confirmed
              .filter((a) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return (
                  a.name.toLowerCase().includes(q) ||
                  (a.dept ?? "").toLowerCase().includes(q) ||
                  (a.seat ?? "").toLowerCase().includes(q)
                );
              })
              .sort((a, b) => Number(!!a.checkedInAt) - Number(!!b.checkedInAt) || (a.seat ?? "").localeCompare(b.seat ?? ""));

            return (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="truncate text-[22px] font-bold tracking-tight">{flight.title}</h1>
                    <p className="text-sub mt-0.5 text-[13px]">
                      {flight.code} · 登機門 {flight.gate}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sub text-[12px] font-medium">已報到</div>
                    <div className="text-ok-deep text-[26px] font-bold tabular-nums leading-tight">
                      {boarded.length}/{confirmed.length}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {/* 掃描區 */}
                  <div>
                    <QrScan active={cameraOn} onScan={onScan} />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => setCameraOn(!cameraOn)}
                        className={`btn text-[14px] ${cameraOn ? "btn-danger" : "btn-primary"}`}
                      >
                        {cameraOn ? "■ 停止掃描" : "▶ 啟動相機掃描"}
                      </button>
                      <span className="text-sub text-[12px] leading-relaxed">
                        掃乘客登機證上的 QR CODE
                        <br />
                        （相機需要 HTTPS 或 localhost）
                      </span>
                    </div>

                    {flash && (
                      <div className={`tint ${FLASH_STYLE[flash.kind].cls} mt-4 px-5 py-5 text-center`}>
                        <div className="text-[22px] font-bold">
                          {FLASH_STYLE[flash.kind].icon} {FLASH_STYLE[flash.kind].title}
                        </div>
                        <div className="mt-0.5 text-[13px] opacity-80">{FLASH_STYLE[flash.kind].sub}</div>
                        {"attendee" in flash && (
                          <div className="mt-2.5 text-[17px] font-semibold">
                            {flash.attendee.name}
                            {flash.attendee.dept && <span className="ml-2 text-[13px] opacity-75">{flash.attendee.dept}</span>}
                            {flash.attendee.seat && <span className="ml-3">座位 {flash.attendee.seat}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 手動名單 */}
                  <div>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="field-input"
                      placeholder="🔍 搜尋姓名 / 部門 / 座位（手動報到備援）"
                    />
                    <div className="card mt-3 max-h-[480px] overflow-y-auto">
                      {list.length === 0 ? (
                        <div className="text-sub px-4 py-10 text-center text-[14px]">沒有符合的乘客</div>
                      ) : (
                        list.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0"
                          >
                            <div className="flex min-w-0 items-baseline gap-3">
                              <span className="text-accent w-10 shrink-0 text-[15px] font-bold tabular-nums">
                                {a.seat ?? "—"}
                              </span>
                              <span className="truncate text-[14px] font-semibold">{a.name}</span>
                              {a.dept && <span className="text-sub hidden text-[12px] sm:inline">{a.dept}</span>}
                            </div>
                            {a.checkedInAt ? (
                              <button
                                onClick={() => setBoarded(a.id, false)}
                                className="btn btn-secondary shrink-0 px-3 py-1.5 text-[12px]"
                              >
                                ✓ {fmtTime(a.checkedInAt)}（點擊取消）
                              </button>
                            ) : (
                              <button
                                onClick={() => setBoarded(a.id, true)}
                                className="btn btn-primary shrink-0 px-3 py-1.5 text-[12px]"
                              >
                                報到
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {standbyCount > 0 && (
                      <p className="text-warn-deep mt-2 text-[13px]">
                        另有 {standbyCount} 位候補——遞補請到「乘客名單」操作。
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <Link href={`/admin/${flight.code}`} className="text-accent text-[13px] font-medium">
                    ← 返回乘客名單
                  </Link>
                </div>
              </>
            );
          })()
        )}
      </AdminGate>
    </BoardShell>
  );
}

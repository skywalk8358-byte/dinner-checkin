"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { BoardHeader, BoardShell, NotFoundBoard } from "@/components/Chrome";
import { QrScan } from "@/components/QrScan";
import { Flap } from "@/components/SplitFlap";
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

const FLASH_STYLE: Record<ScanResult["kind"], { cls: string; en: string; zh: string }> = {
  ok: { cls: "border-ok/60 bg-ok/10 text-ok", en: "WELCOME ABOARD", zh: "登機完成" },
  already: { cls: "border-warn/60 bg-warn/10 text-warn", en: "ALREADY BOARDED", zh: "已經報到過了" },
  standby: { cls: "border-warn/60 bg-warn/10 text-warn", en: "STANDBY PASS", zh: "候補票——請洽主辦人遞補" },
  "wrong-flight": { cls: "border-bad/60 bg-bad/10 text-bad", en: "WRONG FLIGHT", zh: "不是本場活動的登機證" },
  invalid: { cls: "border-bad/60 bg-bad/10 text-bad", en: "INVALID PASS", zh: "無效的登機證" },
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
      <BoardHeader sub="BOARDING GATE · 登機口" />
      <AdminGate>
        {!hydrated ? (
          <div className="text-dim py-12 text-center text-xs tracking-[0.35em]">LOADING…</div>
        ) : (
          (() => {
            const flight = flightByCode(db, decodeURIComponent(code));
            if (!flight) return <NotFoundBoard message={`找不到航班 ${decodeURIComponent(code)}`} backHref="/admin" backLabel="返回後台" />;

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
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <Flap text={flight.code} className="text-xl font-bold" />
                    <span className="text-sm">{flight.title}</span>
                    <span className="text-dim text-xs tracking-widest">GATE {flight.gate}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-dim text-xs tracking-[0.3em]">BOARDED</span>
                    <Flap text={`${boarded.length}/${confirmed.length}`} className="text-2xl font-bold text-ok" />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {/* 掃描區 */}
                  <div>
                    <QrScan active={cameraOn} onScan={onScan} />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => setCameraOn(!cameraOn)}
                        className={`btn text-sm ${cameraOn ? "btn-danger" : "btn-primary"}`}
                      >
                        {cameraOn ? "■ 停止掃描" : "▶ 啟動相機掃描"}
                      </button>
                      <span className="text-dim text-[11px] leading-relaxed">
                        掃乘客登機證上的 QR CODE
                        <br />
                        （相機需要 HTTPS 或 localhost）
                      </span>
                    </div>

                    {flash && (
                      <div className={`mt-4 rounded-xl border px-5 py-6 text-center ${FLASH_STYLE[flash.kind].cls}`}>
                        <div className="text-2xl font-bold tracking-[0.15em]">
                          {flash.kind === "ok" ? "✓ " : flash.kind === "invalid" || flash.kind === "wrong-flight" ? "✕ " : "！"}
                          {FLASH_STYLE[flash.kind].en}
                        </div>
                        <div className="mt-1 text-sm tracking-widest">{FLASH_STYLE[flash.kind].zh}</div>
                        {"attendee" in flash && (
                          <div className="mt-3 text-lg font-semibold">
                            {flash.attendee.name}
                            {flash.attendee.dept && <span className="ml-2 text-sm opacity-80">{flash.attendee.dept}</span>}
                            {flash.attendee.seat && <span className="ml-3 text-xl">SEAT {flash.attendee.seat}</span>}
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
                    <div className="panel mt-3 max-h-[480px] overflow-y-auto">
                      {list.length === 0 ? (
                        <div className="text-dim px-4 py-8 text-center text-sm">沒有符合的乘客</div>
                      ) : (
                        list.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-3 border-b border-seam/40 px-4 py-2.5 last:border-b-0"
                          >
                            <div className="flex min-w-0 items-baseline gap-3">
                              <span className="glow-text w-10 shrink-0 text-base font-bold">{a.seat ?? "—"}</span>
                              <span className="truncate text-sm font-semibold">{a.name}</span>
                              {a.dept && <span className="text-dim hidden text-xs sm:inline">{a.dept}</span>}
                            </div>
                            {a.checkedInAt ? (
                              <button onClick={() => setBoarded(a.id, false)} className="btn btn-ghost shrink-0 px-2.5 py-1 text-[11px]">
                                ✓ {fmtTime(a.checkedInAt)}（點擊取消）
                              </button>
                            ) : (
                              <button onClick={() => setBoarded(a.id, true)} className="btn btn-primary shrink-0 px-2.5 py-1 text-[11px]">
                                報到
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    {standbyCount > 0 && (
                      <p className="text-warn mt-2 text-xs tracking-wider">
                        另有 {standbyCount} 位候補——遞補請到「乘客名單」操作。
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <Link href={`/admin/${flight.code}`} className="text-dim text-xs tracking-widest hover:text-glow">
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

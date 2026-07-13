"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BoardingPass } from "@/components/BoardingPass";
import { BoardHeader, BoardShell, NotFoundBoard } from "@/components/Chrome";
import { StepBar } from "@/components/StepBar";
import { byToken, useDB, useHydrated } from "@/lib/store";

/** 個人登機證頁 —— 報名完成的最終畫面，也是之後回訪、入場出示的頁面 */
export default function PassPage() {
  const { token } = useParams<{ token: string }>();
  const isNew = useSearchParams().has("new");
  const db = useDB();
  const hydrated = useHydrated();

  const [copied, setCopied] = useState(false);

  if (!hydrated) {
    return (
      <BoardShell>
        <BoardHeader />
        <div className="text-dim py-16 text-center text-xs tracking-[0.35em]">PRINTING…</div>
      </BoardShell>
    );
  }

  const attendee = byToken(db, decodeURIComponent(token));
  const flight = attendee ? db.flights.find((f) => f.id === attendee.flightId) : undefined;

  if (!attendee || !flight || attendee.status === "cancelled") {
    return (
      <BoardShell>
        <BoardHeader />
        <NotFoundBoard
          message={
            attendee?.status === "cancelled"
              ? "這張登機證已被取消。如有疑問請聯絡主辦人。"
              : "找不到這張登機證，請確認代碼是否正確。"
          }
        />
      </BoardShell>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + `/pass/${attendee.passToken}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <BoardShell>
      <div className="no-print">
        <BoardHeader sub={`BOARDING PASS · ${flight.code} ${flight.title}`} />
        {isNew && <StepBar current={3} standby={attendee.status === "standby"} />}

        {attendee.status === "standby" && (
          <p className="text-warn mb-5 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm leading-relaxed">
            你目前是候補（STANDBY）——有人取消時主辦人會依序遞補，遞補後就能選位。請保留這張登機證。
          </p>
        )}
        {attendee.status === "confirmed" && !attendee.seat && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-glow/40 bg-glow/10 px-4 py-3">
            <span className="text-sm">已為你保留名額，還差一步——選個好位子！</span>
            <Link href={`/flight/${flight.code}/seat?pass=${attendee.passToken}`} className="btn btn-primary px-4 py-2 text-xs">
              SELECT SEAT · 去選位
            </Link>
          </div>
        )}
      </div>

      <BoardingPass flight={flight} attendee={attendee} animate={isNew} />

      <div className="no-print mt-6 flex flex-wrap items-center gap-3">
        <button onClick={() => window.print()} className="btn btn-primary text-sm">
          🖨 列印 / 存成 PDF
        </button>
        <button onClick={copyLink} className="btn btn-ghost text-sm">
          {copied ? "✓ 已複製" : "🔗 複製登機證連結"}
        </button>
        <Link href={`/flight/${flight.code}`} className="btn btn-ghost text-sm">
          ← 航班資訊
        </Link>
      </div>

      <p className="no-print text-dim mt-4 text-xs leading-relaxed tracking-wider">
        聚餐當天請出示票根上的 QR CODE 完成登機。建議把此頁加入書籤或截圖保存。
      </p>
    </BoardShell>
  );
}

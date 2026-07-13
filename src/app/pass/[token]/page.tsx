"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BoardingPass } from "@/components/BoardingPass";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
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
        <Loading />
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
        <BoardHeader sub={`${flight.code} ${flight.title}`} />
        {isNew && <StepBar current={3} standby={attendee.status === "standby"} />}

        {attendee.status === "standby" && (
          <p className="tint tint-warn mb-4">
            你目前是候補——有人取消時主辦人會依序遞補，遞補後就能選位。請保留這張登機證。
          </p>
        )}
        {attendee.status === "confirmed" && !attendee.seat && (
          <div className="tint tint-accent mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>已為你保留名額，還差一步——選個好位子！</span>
            <Link
              href={`/flight/${flight.code}/seat?pass=${attendee.passToken}`}
              className="btn btn-primary px-4 py-2 text-[13px]"
            >
              去選位
            </Link>
          </div>
        )}
      </div>

      <BoardingPass flight={flight} attendee={attendee} animate={isNew} />

      <div className="no-print mx-auto mt-5 flex w-full max-w-[420px] flex-col gap-2.5">
        <button onClick={() => window.print()} className="btn btn-primary w-full">
          列印 / 存成 PDF
        </button>
        <div className="flex gap-2.5">
          <button onClick={copyLink} className="btn btn-secondary flex-1 text-[14px]">
            {copied ? "✓ 已複製" : "複製連結"}
          </button>
          <Link href={`/flight/${flight.code}`} className="btn btn-secondary flex-1 text-[14px]">
            活動資訊
          </Link>
        </div>
        <p className="text-sub mt-1 text-center text-[12px] leading-relaxed">
          聚餐當天請出示 QR CODE 完成報到，建議加入書籤或截圖保存。
        </p>
      </div>
    </BoardShell>
  );
}

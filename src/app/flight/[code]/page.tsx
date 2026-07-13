"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
import { useNow } from "@/lib/client";
import { fmtDate, fmtTime, fmtTimeRange } from "@/lib/format";
import { confirmedOf, flightByCode, standbyOf, useDB, useHydrated } from "@/lib/store";
import { flightCapacity, flightPhase, PHASE_LABEL } from "@/lib/types";

const TONE_PILL = { ok: "pill-ok", warn: "pill-warn", bad: "pill-bad", dim: "pill-dim" } as const;

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sub text-[12px] font-medium">{label}</div>
      <div className="mt-0.5 text-[16px] font-semibold leading-snug">{value}</div>
    </div>
  );
}

/** 航班（活動）資訊頁 */
export default function FlightPage() {
  const { code } = useParams<{ code: string }>();
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(15_000);
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");

  if (!hydrated) {
    return (
      <BoardShell>
        <BoardHeader />
        <Loading />
      </BoardShell>
    );
  }

  const flight = flightByCode(db, decodeURIComponent(code));
  if (!flight) {
    return (
      <BoardShell>
        <BoardHeader />
        <NotFoundBoard message={`找不到航班 ${decodeURIComponent(code)}，可能已被取消。`} />
      </BoardShell>
    );
  }

  const confirmed = confirmedOf(db, flight.id).length;
  const standby = standbyOf(db, flight.id).length;
  const cap = flightCapacity(flight);
  const left = Math.max(0, cap - confirmed);
  const phase = flightPhase(flight, confirmed, new Date(now));
  const label = PHASE_LABEL[phase];
  const boardingAt = new Date(new Date(flight.departAt).getTime() - flight.boardingMinutes * 60_000);
  const canCheckin = phase === "open" || phase === "boarding";
  const canStandby = phase === "standby";

  return (
    <BoardShell>
      <BoardHeader sub={flight.code} />

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <span className={`pill ${TONE_PILL[label.tone]}`}>{label.zh}</span>
          <span className="text-sub text-[13px] font-medium">{flight.code}</span>
        </div>

        <h1 className="mt-3 text-[24px] font-bold leading-snug tracking-tight">{flight.title}</h1>

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[21px] font-extrabold tracking-tight">{flight.origin}</div>
            <div className="text-sub mt-0.5 text-[12px]">出發地</div>
          </div>
          <span className="text-accent mt-1.5 shrink-0 text-[17px]">✈</span>
          <div className="min-w-0 text-right">
            <div className="text-[21px] font-extrabold leading-tight tracking-tight">{flight.venueName}</div>
            <div className="text-sub mt-0.5 truncate text-[12px]">{flight.venueAddress || "地點見備註"}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
          <Info label="日期" value={fmtDate(flight.departAt)} />
          <Info label="入場" value={fmtTime(boardingAt.toISOString())} />
          <Info label={flight.endAt ? "時間" : "開席"} value={fmtTimeRange(flight.departAt, flight.endAt)} />
          <Info label="登機門" value={flight.gate} />
          <Info
            label="剩餘座位"
            value={
              <>
                {left} <span className="text-sub text-[13px] font-normal">/ {cap}</span>
                {standby > 0 && <span className="text-warn-deep ml-2 text-[13px]">候補 {standby}</span>}
              </>
            }
          />
        </div>

        {flight.notes && <p className="tint tint-accent mt-5 whitespace-pre-line">{flight.notes}</p>}

        <div className="mt-6 flex flex-col gap-2.5">
          {canCheckin && (
            <Link href={`/flight/${flight.code}/checkin`} className="btn btn-primary w-full text-[16px]">
              CHECK IN · 開始報名
            </Link>
          )}
          {canStandby && (
            <Link
              href={`/flight/${flight.code}/checkin`}
              className="btn w-full text-[16px]"
              style={{ background: "var(--color-warn)", color: "#fff" }}
            >
              JOIN STANDBY · 加入候補
            </Link>
          )}
          {!canCheckin && !canStandby && (
            <button disabled className="btn btn-primary w-full text-[16px]">
              {label.zh}
            </button>
          )}
          <Link href="/" className="btn btn-secondary w-full text-[14px]">
            ← 所有航班
          </Link>
        </div>
      </div>

      <form
        className="mt-5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (tokenInput.trim()) router.push(`/pass/${tokenInput.trim().toUpperCase()}`);
        }}
      >
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="已報名？輸入登機證代碼查看"
          className="field-input flex-1 text-[14px]"
        />
        <button type="submit" className="btn btn-secondary px-4 py-2.5 text-[14px]">
          查看
        </button>
      </form>
    </BoardShell>
  );
}

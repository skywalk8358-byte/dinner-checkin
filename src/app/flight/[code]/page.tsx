"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BoardHeader, BoardShell, NotFoundBoard } from "@/components/Chrome";
import { Flap } from "@/components/SplitFlap";
import { useNow } from "@/lib/client";
import { fmtDate, fmtTime } from "@/lib/format";
import { confirmedOf, flightByCode, standbyOf, useDB, useHydrated } from "@/lib/store";
import { flightCapacity, flightPhase, PHASE_LABEL } from "@/lib/types";

const TONE_CLASS = { ok: "text-ok", warn: "text-warn", bad: "text-bad", dim: "text-dim" } as const;

function InfoTile({ label, zh, value }: { label: string; zh: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-tile px-4 py-3">
      <div className="text-dim text-[10px] tracking-[0.25em]">
        {label} <span className="ml-1">{zh}</span>
      </div>
      <div className="glow-text mt-1 text-lg font-semibold leading-snug">{value}</div>
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
        <div className="text-dim py-16 text-center text-xs tracking-[0.35em]">LOADING…</div>
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
      <BoardHeader />

      <div className="panel p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Flap text={flight.origin} className="text-2xl font-bold sm:text-4xl" />
          <span className="text-glow-soft text-2xl sm:text-3xl">✈</span>
          <Flap text={flight.venueName} className="text-2xl font-bold sm:text-4xl" />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-base sm:text-lg">{flight.title}</span>
          <span className="text-dim text-sm tracking-widest">{flight.code}</span>
          <span
            className={`text-xs font-bold tracking-widest ${TONE_CLASS[label.tone]} ${phase === "boarding" ? "blink" : ""}`}
          >
            ● {label.en} {label.zh}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <InfoTile label="DATE" zh="日期" value={fmtDate(flight.departAt)} />
          <InfoTile label="BOARDING" zh="入場" value={fmtTime(boardingAt.toISOString())} />
          <InfoTile label="DEPARTS" zh="開席" value={fmtTime(flight.departAt)} />
          <InfoTile label="GATE" zh="登機門" value={flight.gate} />
          <InfoTile
            label="SEATS LEFT"
            zh="剩餘座位"
            value={
              <>
                {left}
                <span className="text-dim text-sm"> / {cap}</span>
                {standby > 0 && <span className="text-warn ml-2 text-sm">候補 {standby}</span>}
              </>
            }
          />
          <InfoTile label="VENUE" zh="地點" value={<span className="text-base">{flight.venueAddress}</span>} />
        </div>

        {flight.notes && (
          <p className="text-dim mt-4 border-l-2 border-seam pl-3 text-sm leading-relaxed">{flight.notes}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {canCheckin && (
            <Link href={`/flight/${flight.code}/checkin`} className="btn btn-primary text-base">
              CHECK IN · 開始報名
            </Link>
          )}
          {canStandby && (
            <Link
              href={`/flight/${flight.code}/checkin`}
              className="btn text-base"
              style={{ background: "var(--color-warn)", color: "#171001" }}
            >
              JOIN STANDBY · 加入候補
            </Link>
          )}
          {!canCheckin && !canStandby && (
            <button disabled className="btn btn-primary text-base">
              {label.en} · {label.zh}
            </button>
          )}
          <Link href="/" className="btn btn-ghost text-sm">
            ← 所有航班
          </Link>
        </div>
      </div>

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (tokenInput.trim()) router.push(`/pass/${tokenInput.trim().toUpperCase()}`);
        }}
      >
        <span className="text-dim text-xs tracking-[0.25em]">已報名？輸入登機證代碼 →</span>
        <input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="DN0808-XXXXXX"
          className="field-input max-w-52 py-1.5 text-xs"
        />
        <button type="submit" className="btn btn-ghost px-3 py-1.5 text-xs">
          查看
        </button>
      </form>
    </BoardShell>
  );
}

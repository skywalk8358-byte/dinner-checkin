"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BoardHeader, BoardShell, NotFoundBoard } from "@/components/Chrome";
import { SeatLegend, SeatMap } from "@/components/SeatMap";
import { Flap } from "@/components/SplitFlap";
import { clearPending, StepBar, usePendingSignup } from "@/components/StepBar";
import { useHydrated } from "@/lib/client";
import { addAttendee, assignSeat, byToken, flightByCode, takenSeats, useDB } from "@/lib/store";

/**
 * 選位頁。兩種進場方式：
 * 1. 報名流程第二步（旅客資料暫存於 pending store / sessionStorage）
 * 2. 已有登機證但還沒座位的人補選位：/flight/XX/seat?pass=<token>
 */
export default function SeatPage() {
  const { code } = useParams<{ code: string }>();
  const reseatToken = useSearchParams().get("pass");
  const db = useDB();
  const hydrated = useHydrated();
  const router = useRouter();

  const flight = hydrated ? flightByCode(db, decodeURIComponent(code)) : undefined;
  const pending = usePendingSignup(reseatToken ? undefined : flight?.code);

  const [selected, setSelected] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  // 完成選位後 pending 會被清掉，用這個旗標避免被誤判成「沒報名」而踢回櫃檯
  const [done, setDone] = useState(false);

  // 沒有進行中的報名、也不是補選位 → 回櫃檯重新開始
  const shouldBounce = hydrated && !!flight && !reseatToken && !pending && !done;
  useEffect(() => {
    if (shouldBounce && flight) router.replace(`/flight/${flight.code}/checkin`);
  }, [shouldBounce, flight, router]);

  if (!hydrated || shouldBounce) {
    return (
      <BoardShell wide>
        <BoardHeader />
        <div className="text-dim py-16 text-center text-xs tracking-[0.35em]">LOADING…</div>
      </BoardShell>
    );
  }

  if (!flight) {
    return (
      <BoardShell>
        <BoardHeader />
        <NotFoundBoard message={`找不到航班 ${decodeURIComponent(code)}`} />
      </BoardShell>
    );
  }

  const reseatAttendee = reseatToken ? byToken(db, reseatToken) : undefined;
  if (reseatToken && (!reseatAttendee || reseatAttendee.flightId !== flight.id || reseatAttendee.status !== "confirmed")) {
    return (
      <BoardShell>
        <BoardHeader />
        <NotFoundBoard
          message="這張登機證無法在此航班選位（可能是候補票或已取消）。"
          backHref={`/flight/${flight.code}`}
          backLabel="返回航班頁"
        />
      </BoardShell>
    );
  }

  const taken = takenSeats(db, flight.id);
  const passengerName = pending?.name ?? reseatAttendee?.name ?? "";

  const confirm = () => {
    if (!selected) return;

    if (pending) {
      const res = addAttendee({ flightId: flight.id, ...pending, seat: selected });
      if (!res.ok) {
        setError("這個座位剛被別人選走了，請再挑一個。");
        setSelected(undefined);
        return;
      }
      setDone(true);
      clearPending(flight.code);
      const suffix = res.attendee.status === "standby" ? "&standby=1" : "";
      router.push(`/pass/${res.attendee.passToken}?new=1${suffix}`);
      return;
    }

    if (reseatAttendee) {
      if (!assignSeat(reseatAttendee.id, selected)) {
        setError("這個座位剛被別人選走了，請再挑一個。");
        setSelected(undefined);
        return;
      }
      router.push(`/pass/${reseatAttendee.passToken}`);
    }
  };

  return (
    <BoardShell wide>
      <BoardHeader sub={`SEAT SELECTION · ${flight.code} ${flight.title}`} />
      {pending && <StepBar current={2} />}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Flap text="SELECT YOUR SEAT" className="text-xl font-bold" />
          <p className="text-dim mt-1 text-xs tracking-[0.25em]">
            {passengerName} · 請點選座位（桌號＋字母，例如 3F＝第 3 桌 F 位）
          </p>
        </div>
        <SeatLegend />
      </div>

      {error && (
        <p className="text-bad mb-4 rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm">{error}</p>
      )}

      <SeatMap
        flight={flight}
        taken={taken}
        selected={selected}
        onSelect={(s) => {
          setSelected(s);
          setError(null);
        }}
      />

      {/* 底部確認列 */}
      <div className="sticky bottom-3 mt-6">
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="text-dim text-xs tracking-[0.3em]">SEAT 座位</span>
            <Flap text={selected ?? "--"} className="text-2xl font-bold" />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={pending ? `/flight/${flight.code}/checkin` : `/pass/${reseatToken}`}
              className="btn btn-ghost text-sm"
            >
              ← 上一步
            </Link>
            <button onClick={confirm} disabled={!selected} className="btn btn-primary">
              CONFIRM · 確認選位
            </button>
          </div>
        </div>
      </div>
    </BoardShell>
  );
}

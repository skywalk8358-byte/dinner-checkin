"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
import { SeatLegend, SeatMap } from "@/components/SeatMap";
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
  // 點擊已入座的座位 → 顯示是誰（姓名＋產業）
  const [peek, setPeek] = useState<{ code: string; name: string; industry?: string } | null>(null);
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
        <Loading />
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
          message="這張登機證無法在此活動選位（可能是候補票或已取消）。"
          backHref={`/flight/${flight.code}`}
          backLabel="返回活動頁"
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
      <BoardHeader sub={`${flight.code} ${flight.title}`} />
      {pending && <StepBar current={2} />}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">選擇座位</h1>
          <p className="text-sub mt-1 text-[13px]">
            {passengerName} · 點空位入座；點已入座的位子可以看看是誰
          </p>
        </div>
        <SeatLegend />
      </div>

      {error && <p className="tint tint-bad mb-4">{error}</p>}
      {peek && (
        <div className="tint tint-accent mb-4 flex items-center justify-between gap-3">
          <span>
            <span className="font-semibold">{peek.code}</span> · {peek.name}
            {peek.industry && <span className="opacity-75">（{peek.industry}）</span>}
          </span>
          <button onClick={() => setPeek(null)} className="shrink-0 text-[13px] font-semibold opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      <SeatMap
        flight={flight}
        taken={taken}
        selected={selected}
        onSelect={(s) => {
          setSelected(s);
          setError(null);
        }}
        onPeek={(code, attendee) => setPeek({ code, name: attendee.name, industry: attendee.industry })}
      />

      {/* 底部確認列 */}
      <div className="sticky bottom-3 mt-6">
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-sub text-[13px] font-medium">座位</span>
            <span className="text-accent text-[24px] font-extrabold tabular-nums">{selected ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href={pending ? `/flight/${flight.code}/checkin` : `/pass/${reseatToken}`}
              className="btn btn-secondary text-[14px]"
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

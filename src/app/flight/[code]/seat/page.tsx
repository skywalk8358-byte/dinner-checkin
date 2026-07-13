"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
import { SeatLegend, SeatMap } from "@/components/SeatMap";
import { clearPending, StepBar, usePendingSignup } from "@/components/StepBar";
import { useHydrated } from "@/lib/client";
import { addGroup, assignSeat, byToken, flightByCode, takenSeats, useDB } from "@/lib/store";

/**
 * 選位頁。兩種進場方式：
 * 1. 報名流程第二步——可直接選 1～名額上限個位子；第 2 位起的同行者姓名在確認列填
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

  const [selected, setSelected] = useState<string[]>([]);
  /** 第 i+2 個座位的同行者姓名（index 0 = 第二個座位） */
  const [companionNames, setCompanionNames] = useState<string[]>([]);
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
  const leadName = reseatAttendee?.name ?? pending?.name ?? "";
  const maxSeats = reseatAttendee ? 1 : Math.max(1, pending?.maxSeats ?? 1);

  const toggleSeat = (seatCode: string) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(seatCode)) return prev.filter((s) => s !== seatCode);
      if (prev.length < maxSeats) return [...prev, seatCode];
      // 已選滿：換掉最後一個
      return [...prev.slice(0, maxSeats - 1), seatCode];
    });
  };

  const setCompanionName = (i: number, value: string) => {
    setCompanionNames((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push("");
      next[i] = value;
      return next;
    });
  };

  const companionsOk = selected.slice(1).every((_, i) => (companionNames[i] ?? "").trim());
  const canConfirm = selected.length >= 1 && companionsOk;

  const confirm = () => {
    if (!canConfirm) return;

    if (pending) {
      const people = [
        { name: pending.name, industry: pending.industry },
        ...selected.slice(1).map((_, i) => ({ name: companionNames[i].trim(), industry: "" })),
      ];
      const res = addGroup({
        flightId: flight.id,
        inviteId: pending.inviteId,
        people,
        note: pending.note,
        seats: selected,
      });
      if (!res.ok) {
        if (res.reason === "seat-taken") {
          setError("有座位剛被別人選走了，請重新選擇。");
          setSelected([]);
        } else if (res.reason === "quota-exceeded") {
          setError("接龍名額不足（可能剛被使用），請回上一步確認。");
        } else if (res.reason === "not-enough-seats") {
          setError("剩餘座位不足，請減少選位數。");
        } else {
          setError("報名失敗，請回上一步重新開始。");
        }
        return;
      }
      setDone(true);
      clearPending(flight.code);
      router.push(`/pass/${res.attendees[0].passToken}?new=1`);
      return;
    }

    if (reseatAttendee) {
      if (!assignSeat(reseatAttendee.id, selected[0])) {
        setError("這個座位剛被別人選走了，請再挑一個。");
        setSelected([]);
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
            {maxSeats > 1
              ? `${leadName} · 名額 ${maxSeats} 位——直接點 1～${maxSeats} 個空位，同行者姓名在下方填`
              : `${leadName} · 點空位入座`}
            ；點已入座的位子可以看看是誰
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
        onSelect={toggleSeat}
        onPeek={(seatCode, attendee) => setPeek({ code: seatCode, name: attendee.name, industry: attendee.industry })}
      />

      {/* 底部確認列 */}
      <div className="sticky bottom-3 mt-6">
        <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            {selected.length === 0 ? (
              <div className="flex items-baseline gap-2.5">
                <span className="text-sub text-[13px] font-medium">座位</span>
                <span className="text-sub text-[24px] font-extrabold">—</span>
                {maxSeats > 1 && <span className="text-sub text-[12px]">可選 {maxSeats} 位</span>}
              </div>
            ) : (
              selected.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="text-accent text-[18px] font-extrabold tabular-nums">{s}</span>
                  {i === 0 ? (
                    <span className="text-[13px] font-medium">{leadName}</span>
                  ) : (
                    <input
                      value={companionNames[i - 1] ?? ""}
                      onChange={(e) => setCompanionName(i - 1, e.target.value)}
                      placeholder="同行者姓名"
                      maxLength={30}
                      className="field-input w-28 px-2.5 py-1.5 text-[13px]"
                    />
                  )}
                </span>
              ))
            )}
            {selected.length > 0 && selected.length < maxSeats && (
              <span className="text-sub text-[12px]">還可再選 {maxSeats - selected.length} 位</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href={pending ? `/flight/${flight.code}/checkin` : `/pass/${reseatToken}`}
              className="btn btn-secondary text-[14px]"
            >
              ← 上一步
            </Link>
            <button onClick={confirm} disabled={!canConfirm} className="btn btn-primary">
              CONFIRM · 確認選位
            </button>
          </div>
        </div>
      </div>
    </BoardShell>
  );
}

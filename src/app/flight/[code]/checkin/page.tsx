"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
import { StepBar, writePending } from "@/components/StepBar";
import { useNow } from "@/lib/client";
import { addAttendee, confirmedOf, flightByCode, useDB, useHydrated } from "@/lib/store";
import { flightPhase } from "@/lib/types";

/** 報名表單（報到櫃檯） */
export default function CheckinPage() {
  const { code } = useParams<{ code: string }>();
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(15_000);
  const router = useRouter();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        <NotFoundBoard message={`找不到航班 ${decodeURIComponent(code)}`} />
      </BoardShell>
    );
  }

  const phase = flightPhase(flight, confirmedOf(db, flight.id).length, new Date(now));
  if (phase === "closed" || phase === "departed") {
    return (
      <BoardShell>
        <BoardHeader />
        <NotFoundBoard
          message={phase === "closed" ? "此活動已截止報名。" : "此活動已開席，無法再報名。"}
          backHref={`/flight/${flight.code}`}
          backLabel="返回活動頁"
        />
      </BoardShell>
    );
  }
  const isStandby = phase === "standby";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    if (isStandby) {
      // 已滿：直接建立候補，不經過選位
      setSubmitting(true);
      const res = addAttendee({ flightId: flight.id, name, industry, note });
      if (res.ok) router.push(`/pass/${res.attendee.passToken}?new=1`);
      else setSubmitting(false);
      return;
    }

    writePending(flight.code, { name: name.trim(), industry: industry.trim(), note: note.trim() });
    router.push(`/flight/${flight.code}/seat`);
  };

  return (
    <BoardShell>
      <BoardHeader sub={`${flight.code} ${flight.title}`} />
      <StepBar current={1} standby={isStandby} />

      <div className="card p-6">
        <h1 className="text-[22px] font-bold tracking-tight">旅客資料</h1>
        <p className="text-sub mt-1 text-[13px]">填好資料就能選位、領登機證</p>

        {isStandby && (
          <p className="tint tint-warn mt-4">
            本活動座位已滿——你仍可加入候補，有人取消時主辦人會依序遞補。
          </p>
        )}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
          <label className="block">
            <span className="text-sub mb-1.5 block text-[13px] font-medium">姓名 *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              placeholder="王小明"
              maxLength={30}
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-sub mb-1.5 block text-[13px] font-medium">產業</span>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="field-input"
              placeholder="例：餐飲、科技、金融"
              maxLength={20}
            />
          </label>

          <label className="block">
            <span className="text-sub mb-1.5 block text-[13px] font-medium">備註（忌口、過敏等）</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field-input"
              placeholder="例：海鮮過敏、不吃牛"
              maxLength={60}
            />
          </label>

          <div className="mt-1 flex flex-col gap-2.5">
            <button type="submit" disabled={!name.trim() || submitting} className="btn btn-primary w-full text-[16px]">
              {isStandby ? "JOIN STANDBY · 加入候補" : "NEXT · 前往選位 →"}
            </button>
            <Link href={`/flight/${flight.code}`} className="btn btn-secondary w-full text-[14px]">
              ← 返回
            </Link>
          </div>
        </form>
      </div>
    </BoardShell>
  );
}

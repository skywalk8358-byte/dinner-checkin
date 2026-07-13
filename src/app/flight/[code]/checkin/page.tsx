"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BoardHeader, BoardShell, NotFoundBoard } from "@/components/Chrome";
import { Flap } from "@/components/SplitFlap";
import { StepBar, writePending } from "@/components/StepBar";
import { useNow } from "@/lib/client";
import { addAttendee, confirmedOf, flightByCode, useDB, useHydrated } from "@/lib/store";
import type { Meal } from "@/lib/types";
import { flightPhase, MEAL_LABEL } from "@/lib/types";

/** 報名表單（報到櫃檯） */
export default function CheckinPage() {
  const { code } = useParams<{ code: string }>();
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(15_000);
  const router = useRouter();

  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [meal, setMeal] = useState<Meal>("standard");
  const [mealNote, setMealNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          message={phase === "closed" ? "此航班已截止報名。" : "此航班已開席，無法再報名。"}
          backHref={`/flight/${flight.code}`}
          backLabel="返回航班頁"
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
      const res = addAttendee({ flightId: flight.id, name, dept, meal, mealNote });
      if (res.ok) router.push(`/pass/${res.attendee.passToken}?new=1`);
      else setSubmitting(false);
      return;
    }

    writePending(flight.code, { name: name.trim(), dept: dept.trim(), meal, mealNote: mealNote.trim() });
    router.push(`/flight/${flight.code}/seat`);
  };

  return (
    <BoardShell>
      <BoardHeader sub={`CHECK-IN COUNTER · ${flight.code} ${flight.title}`} />
      <StepBar current={1} standby={isStandby} />

      <div className="panel mx-auto max-w-2xl p-5 sm:p-8">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <Flap text="CHECK-IN" className="text-xl font-bold" />
          <span className="text-dim text-xs tracking-[0.3em]">報到櫃檯 · 請填寫旅客資料</span>
        </div>

        {isStandby && (
          <p className="text-warn mb-5 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm leading-relaxed">
            本航班座位已滿——你仍可加入候補（STANDBY），有人取消時主辦人會依序遞補。
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-5">
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">PASSENGER NAME · 姓名 *</span>
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
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">DEPARTMENT · 部門 / 單位</span>
            <input
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="field-input"
              placeholder="研發部"
              maxLength={20}
            />
          </label>

          <div>
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">MEAL PREFERENCE · 餐點選擇</span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeal(m)}
                  className={`rounded-lg border px-3 py-2.5 text-center transition ${
                    meal === m ? "border-glow bg-glow/15 text-glow" : "border-seam text-dim hover:border-glow/50"
                  }`}
                >
                  <div className="text-sm font-semibold">{MEAL_LABEL[m].zh}</div>
                  <div className="mt-0.5 text-[10px] tracking-[0.15em]">{MEAL_LABEL[m].en}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">
              DIETARY NOTES · 忌口 / 備註{meal === "special" ? " *" : ""}
            </span>
            <input
              value={mealNote}
              onChange={(e) => setMealNote(e.target.value)}
              className="field-input"
              placeholder="例：海鮮過敏、不吃牛"
              maxLength={60}
              required={meal === "special"}
            />
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!name.trim() || submitting} className="btn btn-primary">
              {isStandby ? "JOIN STANDBY · 加入候補" : "NEXT · 前往選位 →"}
            </button>
            <Link href={`/flight/${flight.code}`} className="btn btn-ghost text-sm">
              ← 返回
            </Link>
          </div>
        </form>
      </div>
    </BoardShell>
  );
}

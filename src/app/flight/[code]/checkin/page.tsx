"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BoardHeader, BoardShell, Loading, NotFoundBoard } from "@/components/Chrome";
import { StepBar, writePending } from "@/components/StepBar";
import { useNow } from "@/lib/client";
import {
  addGroup,
  confirmedOf,
  flightByCode,
  inviteByName,
  inviteUsed,
  useDB,
  useHydrated,
} from "@/lib/store";
import { flightCapacity, flightPhase } from "@/lib/types";

/** 報名表單（報到櫃檯）：支援一次報多位；接龍模式會鎖名單與名額 */
export default function CheckinPage() {
  const { code } = useParams<{ code: string }>();
  const db = useDB();
  const hydrated = useHydrated();
  const now = useNow(15_000);
  const router = useRouter();

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [count, setCount] = useState(1);
  const [companions, setCompanions] = useState<{ name: string; industry: string }[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  const confirmedCount = confirmedOf(db, flight.id).length;
  const phase = flightPhase(flight, confirmedCount, new Date(now));
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

  const inviteMode = !!flight.inviteOnly;
  const invite = inviteMode ? inviteByName(db, flight.id, name) : undefined;
  const used = invite ? inviteUsed(db, invite.id) : 0;
  const remaining = invite ? Math.max(0, invite.quota - used) : 0;
  const seatsLeft = Math.max(0, flightCapacity(flight) - confirmedCount);

  // 可報人數上限：接龍模式看名額；開放模式一次最多 4 位
  const maxParty = inviteMode ? Math.max(1, remaining) : Math.min(4, Math.max(1, isStandby ? 4 : seatsLeft));
  const effCount = Math.min(count, maxParty);

  const companionAt = (i: number) => companions[i] ?? { name: "", industry: "" };
  const setCompanion = (i: number, patch: Partial<{ name: string; industry: string }>) => {
    setCompanions((prev) => {
      const next = [...prev];
      while (next.length <= i) next.push({ name: "", industry: "" });
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || submitting) return;

    if (inviteMode) {
      if (!invite) {
        setError("找不到接龍名單上的這個名字——請輸入你在 LINE 接龍時用的名字，或聯絡主辦人。");
        return;
      }
      if (remaining === 0) {
        setError("這筆接龍名額已全部使用。如需調整人數，請聯絡主辦人。");
        return;
      }
      if (effCount > remaining) {
        setError(`接龍名額只剩 ${remaining} 位，無法報 ${effCount} 位。`);
        return;
      }
    }

    const people = [
      { name: name.trim(), industry: industry.trim() },
      ...Array.from({ length: effCount - 1 }, (_, i) => ({
        name: companionAt(i).name.trim(),
        industry: companionAt(i).industry.trim(),
      })),
    ];
    if (people.some((p) => !p.name)) {
      setError("請填寫每一位同行者的姓名。");
      return;
    }

    if (isStandby) {
      // 已滿：整組建立候補，不經過選位
      setSubmitting(true);
      const res = addGroup({ flightId: flight.id, inviteId: invite?.id, people, note, seats: [] });
      if (res.ok) router.push(`/pass/${res.attendees[0].passToken}?new=1`);
      else {
        setSubmitting(false);
        setError(res.reason === "quota-exceeded" ? "接龍名額不足。" : "報名失敗，請再試一次。");
      }
      return;
    }

    writePending(flight.code, { inviteId: invite?.id, people, note: note.trim() });
    router.push(`/flight/${flight.code}/seat`);
  };

  return (
    <BoardShell>
      <BoardHeader sub={`${flight.code} ${flight.title}`} />
      <StepBar current={1} standby={isStandby} />

      <div className="card p-6">
        <h1 className="text-[22px] font-bold tracking-tight">旅客資料</h1>
        <p className="text-sub mt-1 text-[13px]">
          {inviteMode ? "本活動採 LINE 接龍名單制——請用接龍時的名字報名選位" : "填好資料就能選位、領登機證"}
        </p>

        {isStandby && (
          <p className="tint tint-warn mt-4">
            本活動座位已滿——你仍可加入候補，有人取消時主辦人會依序遞補。
          </p>
        )}

        <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
          <label className="block">
            <span className="text-sub mb-1.5 block text-[13px] font-medium">
              {inviteMode ? "姓名（接龍時的名字）*" : "姓名 *"}
            </span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="field-input"
              placeholder="王小明"
              maxLength={30}
              required
              autoFocus
            />
            {inviteMode && invite && (
              <span className="text-ok-deep mt-1.5 block text-[13px]">
                ✓ 接龍名額 {invite.quota} 位，已用 {used} 位，還可報 {remaining} 位
              </span>
            )}
            {inviteMode && !invite && name.trim().length >= 2 && (
              <span className="text-warn-deep mt-1.5 block text-[13px]">
                目前不在接龍名單上——請確認名字跟 LINE 接龍一致
              </span>
            )}
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

          {(!inviteMode || (invite && remaining > 0)) && maxParty > 1 && (
            <div>
              <span className="text-sub mb-1.5 block text-[13px] font-medium">報名人數（含本人）</span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`min-w-14 rounded-xl px-4 py-2.5 text-center text-[14px] font-semibold transition ${
                      effCount === n ? "bg-accent text-white" : "bg-inset text-ink hover:bg-[#e4e4ea]"
                    }`}
                  >
                    {n} 位
                  </button>
                ))}
              </div>
            </div>
          )}

          {Array.from({ length: effCount - 1 }, (_, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sub mb-1.5 block text-[13px] font-medium">同行者 {i + 1} 姓名 *</span>
                <input
                  value={companionAt(i).name}
                  onChange={(e) => setCompanion(i, { name: e.target.value })}
                  className="field-input"
                  placeholder="同行者姓名"
                  maxLength={30}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sub mb-1.5 block text-[13px] font-medium">產業</span>
                <input
                  value={companionAt(i).industry}
                  onChange={(e) => setCompanion(i, { industry: e.target.value })}
                  className="field-input"
                  placeholder="產業（選填）"
                  maxLength={20}
                />
              </label>
            </div>
          ))}

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

          {error && <p className="tint tint-bad">{error}</p>}

          <div className="mt-1 flex flex-col gap-2.5">
            <button type="submit" disabled={!name.trim() || submitting} className="btn btn-primary w-full text-[16px]">
              {isStandby
                ? "JOIN STANDBY · 加入候補"
                : effCount > 1
                  ? `NEXT · 為 ${effCount} 位選位 →`
                  : "NEXT · 前往選位 →"}
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

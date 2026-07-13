"use client";

import { useSyncExternalStore } from "react";

/** 報名流程的 sessionStorage 暫存 key（填完資料 → 選位 之間） */
const pendingKey = (flightCode: string) => `dinner-checkin:pending:${flightCode}`;

export interface PendingSignup {
  /** 接龍模式下：這次報名用的名額 id */
  inviteId?: string;
  /** 主報名者 */
  name: string;
  industry: string;
  note: string;
  /** 選位頁最多可選幾個位子（接龍名額或開放模式上限），同行者姓名在選位頁填 */
  maxSeats: number;
}

// 「填完資料、還沒選位」的暫存，包成小 external store 讓頁面能純粹地讀
const pendingCache = new Map<string, PendingSignup | null>();
const pendingListeners = new Set<() => void>();
const notifyPending = () => pendingListeners.forEach((l) => l());

export function writePending(flightCode: string, data: PendingSignup) {
  try {
    sessionStorage.setItem(pendingKey(flightCode), JSON.stringify(data));
  } catch {}
  pendingCache.set(flightCode, data);
  notifyPending();
}

export function clearPending(flightCode: string) {
  try {
    sessionStorage.removeItem(pendingKey(flightCode));
  } catch {}
  pendingCache.set(flightCode, null);
  notifyPending();
}

function readPending(flightCode: string): PendingSignup | null {
  if (!pendingCache.has(flightCode)) {
    try {
      const raw = sessionStorage.getItem(pendingKey(flightCode));
      pendingCache.set(flightCode, raw ? (JSON.parse(raw) as PendingSignup) : null);
    } catch {
      pendingCache.set(flightCode, null);
    }
  }
  return pendingCache.get(flightCode) ?? null;
}

function subscribePending(l: () => void) {
  pendingListeners.add(l);
  return () => {
    pendingListeners.delete(l);
  };
}

export function usePendingSignup(flightCode?: string): PendingSignup | null {
  return useSyncExternalStore(
    subscribePending,
    () => (flightCode ? readPending(flightCode) : null),
    () => null,
  );
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "text-ink" : done ? "text-ok-deep" : "text-sub"}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
          active
            ? "bg-accent text-white"
            : done
              ? "bg-[rgba(52,199,89,0.15)] text-ok-deep"
              : "bg-inset text-sub"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </div>
  );
}

/** 報名三步驟指示條：旅客資料 → 選位 → 登機證 */
export function StepBar({ current, standby = false }: { current: 1 | 2 | 3; standby?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Step n={1} label="旅客資料" active={current === 1} done={current > 1} />
      <span className="text-line">·</span>
      <Step n={2} label={standby ? "選位（候補略過）" : "選擇座位"} active={current === 2} done={current > 2} />
      <span className="text-line">·</span>
      <Step n={3} label="領取登機證" active={current === 3} />
    </div>
  );
}

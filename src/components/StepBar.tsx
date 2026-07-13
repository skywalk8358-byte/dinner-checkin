"use client";

import { useSyncExternalStore } from "react";

/** 報名流程的 sessionStorage 暫存 key（填完資料 → 選位 之間） */
const pendingKey = (flightCode: string) => `dinner-checkin:pending:${flightCode}`;

export interface PendingSignup {
  name: string;
  dept: string;
  meal: "standard" | "veg" | "special";
  mealNote: string;
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
    <div className={`flex items-center gap-2 ${active ? "text-glow" : done ? "text-ok" : "text-dim"}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
          active ? "border-glow bg-glow text-night" : done ? "border-ok" : "border-seam"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className="text-xs tracking-[0.2em]">{label}</span>
    </div>
  );
}

/** 報名三步驟指示條：旅客資料 → 選位 → 登機證 */
export function StepBar({ current, standby = false }: { current: 1 | 2 | 3; standby?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
      <Step n={1} label="旅客資料" active={current === 1} done={current > 1} />
      <span className="text-dim">—</span>
      <Step n={2} label={standby ? "選位（候補略過）" : "選擇座位"} active={current === 2} done={current > 2} />
      <span className="text-dim">—</span>
      <Step n={3} label="領取登機證" active={current === 3} />
    </div>
  );
}

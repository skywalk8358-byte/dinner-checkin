"use client";

import { useState, useSyncExternalStore } from "react";

/**
 * Phase 1 的陽春門禁：通關碼寫在前端環境變數，只防誤闖、不防有心人。
 * Phase 2 接 Supabase 後改用真正的登入（Supabase Auth）。
 */
const ADMIN_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE ?? "0815";
const SS_KEY = "dinner-checkin:crew";

// 解鎖狀態當成一個小小的 external store，跨頁面共用
let crewUnlocked: boolean | null = null;
const crewListeners = new Set<() => void>();

function crewSnapshot(): boolean {
  if (crewUnlocked === null) {
    try {
      crewUnlocked = sessionStorage.getItem(SS_KEY) === "ok";
    } catch {
      crewUnlocked = false;
    }
  }
  return crewUnlocked;
}

function unlockCrew() {
  crewUnlocked = true;
  try {
    sessionStorage.setItem(SS_KEY, "ok");
  } catch {}
  crewListeners.forEach((l) => l());
}

function subscribeCrew(l: () => void) {
  crewListeners.add(l);
  return () => {
    crewListeners.delete(l);
  };
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const open = useSyncExternalStore(subscribeCrew, crewSnapshot, () => false);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);

  if (open) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === ADMIN_CODE) {
      unlockCrew();
    } else {
      setWrong(true);
      setInput("");
    }
  };

  return (
    <div className="card mx-auto mt-14 max-w-sm px-6 py-10 text-center">
      <div className="text-[34px]">🔐</div>
      <h2 className="mt-2 text-[20px] font-bold">主辦人專區</h2>
      <p className="text-sub mt-1 text-[13px]">請輸入通關碼</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="field-input text-center text-[18px] tracking-[0.4em]"
          placeholder="••••"
          autoFocus
        />
        {wrong && <p className="text-bad-deep text-[13px]">通關碼錯誤，請再試一次</p>}
        <button type="submit" className="btn btn-primary">
          UNLOCK 解鎖
        </button>
      </form>
      <p className="text-sub mt-4 text-[11px] leading-relaxed">
        示範用通關碼：0815（部署時可用環境變數 NEXT_PUBLIC_ADMIN_CODE 更換）
      </p>
    </div>
  );
}

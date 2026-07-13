"use client";

import { useState, useSyncExternalStore } from "react";
import { Flap } from "./SplitFlap";

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
    <div className="panel mx-auto mt-16 max-w-sm px-6 py-10 text-center">
      <Flap text="CREW ACCESS" className="justify-center text-xl font-bold" />
      <p className="text-dim mt-2 text-xs tracking-[0.3em]">機組人員專區 · 請輸入通關碼</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="field-input text-center text-lg tracking-[0.5em]"
          placeholder="••••"
          autoFocus
        />
        {wrong && <p className="text-bad text-xs tracking-widest">ACCESS DENIED · 通關碼錯誤</p>}
        <button type="submit" className="btn btn-primary text-sm">
          UNLOCK 解鎖
        </button>
      </form>
      <p className="text-dim mt-4 text-[10px] leading-relaxed">
        示範用通關碼：0815（部署時可用環境變數 NEXT_PUBLIC_ADMIN_CODE 更換）
      </p>
    </div>
  );
}

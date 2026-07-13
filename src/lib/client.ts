"use client";

/**
 * Client 端共用 hooks —— 都用 useSyncExternalStore 實作，
 * 避免「effect 裡同步 setState」與「render 中讀取可變全域」的地雷。
 */

import { useCallback, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** SSR/hydration 安全閥：server 上為 false，client 掛載後為 true */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** 目前時間（毫秒），每 stepMs 跳動一次；server 上為 0 */
export function useNow(stepMs = 1000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const t = setInterval(onChange, stepMs);
      return () => clearInterval(t);
    },
    [stepMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / stepMs) * stepMs, [stepMs]);
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

/** window.location.origin；server 上為空字串 */
export function useOrigin(): string {
  return useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => "",
  );
}

"use client";

/** demo 版 next/navigation：以 hash 路由實作頁面用到的三個 hook */

import { useContext } from "react";
import { ParamsContext, useRouteState } from "./router";

export function useParams<T = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}

export function useSearchParams(): URLSearchParams {
  return useRouteState().query;
}

const router = {
  push(href: string) {
    window.location.hash = href;
  },
  replace(href: string) {
    const url = new URL(window.location.href);
    url.hash = href;
    window.location.replace(url.toString());
  },
  back() {
    window.history.back();
  },
};

export function useRouter() {
  return router;
}

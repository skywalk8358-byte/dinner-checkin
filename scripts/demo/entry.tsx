"use client";

/** 單檔 demo 進入點：hash 路由 + 既有頁面元件，資料層照舊（localStorage 不可用時自動退回記憶體） */

import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import BoardingPage from "@/app/admin/[code]/boarding/page";
import ManifestPage from "@/app/admin/[code]/page";
import AdminPage from "@/app/admin/page";
import CheckinPage from "@/app/flight/[code]/checkin/page";
import FlightPage from "@/app/flight/[code]/page";
import SeatPage from "@/app/flight/[code]/seat/page";
import DeparturesPage from "@/app/page";
import PassPage from "@/app/pass/[token]/page";
import { NotFoundBoard } from "@/components/Chrome";
import { ParamsContext, useRouteState } from "./router";

const ROUTES: Array<{ pattern: string[]; Page: React.ComponentType }> = [
  { pattern: [], Page: DeparturesPage },
  { pattern: ["flight", ":code"], Page: FlightPage },
  { pattern: ["flight", ":code", "checkin"], Page: CheckinPage },
  { pattern: ["flight", ":code", "seat"], Page: SeatPage },
  { pattern: ["pass", ":token"], Page: PassPage },
  { pattern: ["admin"], Page: AdminPage },
  { pattern: ["admin", ":code"], Page: ManifestPage },
  { pattern: ["admin", ":code", "boarding"], Page: BoardingPage },
];

function match(path: string): { Page: React.ComponentType; params: Record<string, string> } | null {
  const segs = path.split("/").filter(Boolean);
  for (const route of ROUTES) {
    if (route.pattern.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    route.pattern.forEach((p, i) => {
      if (p.startsWith(":")) params[p.slice(1)] = segs[i];
      else if (p !== segs[i]) ok = false;
    });
    if (ok) return { Page: route.Page, params };
  }
  return null;
}

function CurrentPage() {
  const { path } = useRouteState();
  const m = match(path);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  if (!m) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <NotFoundBoard message={`沒有這個頁面：${path}`} />
      </main>
    );
  }
  const { Page, params: routeParams } = m;
  return (
    <ParamsContext.Provider value={routeParams}>
      <Page />
    </ParamsContext.Provider>
  );
}

// 沙箱 iframe 會吃掉 confirm() 對話框（一律回 false），demo 直接視為同意
window.confirm = () => true;
document.body.classList.add("antialiased");

createRoot(document.getElementById("root")!).render(<CurrentPage />);

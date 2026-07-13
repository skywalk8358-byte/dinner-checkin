"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { BoardHeader, BoardShell, SectionTitle } from "@/components/Chrome";
import { fmtDate, fmtTime, toLocalInput } from "@/lib/format";
import {
  confirmedOf,
  createFlight,
  flightByCode,
  resetDemo,
  setFlightStatus,
  standbyOf,
  useDB,
  useHydrated,
} from "@/lib/store";
import { flightCapacity } from "@/lib/types";

function defaultDepart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(18, 30, 0, 0);
  return toLocalInput(d.toISOString());
}

function codeFromDate(localValue: string): string {
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return "DN-0000";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `DN-${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function CreateFlightForm() {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [departLocal, setDepartLocal] = useState(defaultDepart);
  const [code, setCode] = useState(() => codeFromDate(defaultDepart()));
  const [codeTouched, setCodeTouched] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [gate, setGate] = useState("");
  const [origin, setOrigin] = useState("OFFICE");
  const [boardingMinutes, setBoardingMinutes] = useState(30);
  const [tableCount, setTableCount] = useState(6);
  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [vipTables, setVipTables] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const capacity = tableCount * seatsPerTable;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !venueName.trim() || !code.trim()) return;
    if (flightByCode(db, code.trim())) {
      setError(`航班代號 ${code.trim().toUpperCase()} 已存在，請換一個。`);
      return;
    }
    const depart = new Date(departLocal);
    if (isNaN(depart.getTime())) {
      setError("請選擇有效的日期時間。");
      return;
    }
    const flight = createFlight({
      code: code.trim(),
      title: title.trim(),
      departAt: depart.toISOString(),
      boardingMinutes,
      origin: origin.trim() || "OFFICE",
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      gate: gate.trim() || "現場公告",
      tableCount,
      seatsPerTable,
      vipTables: Math.min(vipTables, tableCount),
      notes: notes.trim() || undefined,
    });
    setCreatedCode(flight.code);
    setTitle("");
    setVenueName("");
    setVenueAddress("");
    setGate("");
    setNotes("");
  };

  const numField = (value: number, set: (n: number) => void, min: number, max: number) => (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      className="field-input"
    />
  );

  return (
    <div className="panel mt-8 p-5 sm:p-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="glow-text text-base font-bold tracking-[0.2em]">
          ＋ NEW FLIGHT · 開新航班（建立聚餐活動）
        </span>
        <span className="text-dim">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">活動名稱 *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" placeholder="2026 年終尾牙" required />
          </label>

          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">日期時間（開席）*</span>
            <input
              type="datetime-local"
              value={departLocal}
              onChange={(e) => {
                setDepartLocal(e.target.value);
                if (!codeTouched) setCode(codeFromDate(e.target.value));
              }}
              className="field-input"
              required
            />
          </label>
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">航班代號 *</span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setCodeTouched(true);
              }}
              className="field-input"
              placeholder="DN-1231"
              required
            />
          </label>

          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">餐廳名稱 *</span>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className="field-input" placeholder="饗宴會館" required />
          </label>
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">餐廳地址</span>
            <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="field-input" placeholder="台北市…" />
          </label>

          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">登機門（樓層/包廂）</span>
            <input value={gate} onChange={(e) => setGate(e.target.value)} className="field-input" placeholder="2F 宴會廳" />
          </label>
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">出發地顯示文字</span>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} className="field-input" placeholder="OFFICE" />
          </label>

          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">桌數</span>
            {numField(tableCount, setTableCount, 1, 60)}
          </label>
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">每桌座位數</span>
            {numField(seatsPerTable, setSeatsPerTable, 2, 20)}
          </label>
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">VIP 主桌數（由第 1 桌起算）</span>
            {numField(vipTables, setVipTables, 0, 10)}
          </label>
          <label className="block">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">提前入場分鐘數</span>
            {numField(boardingMinutes, setBoardingMinutes, 0, 180)}
          </label>

          <label className="block sm:col-span-2">
            <span className="text-dim mb-1.5 block text-xs tracking-[0.25em]">備註（顯示在航班頁）</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" placeholder="備有素食桌…" />
          </label>

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <button type="submit" className="btn btn-primary text-sm">
              CREATE FLIGHT · 建立
            </button>
            <span className="text-dim text-xs tracking-widest">
              總座位數：{tableCount} 桌 × {seatsPerTable} 位 ＝ {capacity} 席
            </span>
          </div>

          {error && <p className="text-bad text-sm sm:col-span-2">{error}</p>}
          {createdCode && (
            <p className="text-ok text-sm sm:col-span-2">
              ✓ 已建立 {createdCode} ——{" "}
              <Link href={`/flight/${createdCode}`} className="underline">
                報名頁
              </Link>{" "}
              ·{" "}
              <Link href={`/admin/${createdCode}`} className="underline">
                乘客名單
              </Link>
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** 主辦人後台首頁：航班列表 + 開新航班 */
export default function AdminPage() {
  const db = useDB();
  const hydrated = useHydrated();

  return (
    <BoardShell wide>
      <BoardHeader sub="OPERATIONS CONTROL · 主辦人後台" />
      <AdminGate>
        <SectionTitle en="FLIGHTS" zh="航班管理" />

        {!hydrated ? (
          <div className="text-dim py-12 text-center text-xs tracking-[0.35em]">LOADING…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...db.flights]
              .sort((a, b) => new Date(b.departAt).getTime() - new Date(a.departAt).getTime())
              .map((f) => {
                const confirmed = confirmedOf(db, f.id);
                const standby = standbyOf(db, f.id).length;
                const boarded = confirmed.filter((a) => a.checkedInAt).length;
                const cap = flightCapacity(f);
                return (
                  <div key={f.id} className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="glow-text text-lg font-bold tracking-widest">{f.code}</span>
                        <span className="text-sm">{f.title}</span>
                        <span
                          className={`text-[10px] font-bold tracking-[0.2em] ${f.status === "open" ? "text-ok" : "text-bad"}`}
                        >
                          {f.status === "open" ? "OPEN" : "CLOSED"}
                        </span>
                      </div>
                      <div className="text-dim mt-1 text-xs tracking-wider">
                        {fmtDate(f.departAt)} {fmtTime(f.departAt)} · {f.venueName} · 報名 {confirmed.length}/{cap}
                        {standby > 0 && ` · 候補 ${standby}`} · 已登機 {boarded}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/flight/${f.code}`} className="btn btn-ghost px-3 py-1.5 text-xs">
                        報名頁
                      </Link>
                      <Link href={`/admin/${f.code}`} className="btn btn-ghost px-3 py-1.5 text-xs">
                        乘客名單
                      </Link>
                      <Link href={`/admin/${f.code}/boarding`} className="btn btn-ghost px-3 py-1.5 text-xs">
                        登機口
                      </Link>
                      <button
                        onClick={() => setFlightStatus(f.id, f.status === "open" ? "closed" : "open")}
                        className={`btn px-3 py-1.5 text-xs ${f.status === "open" ? "btn-danger" : "btn-ghost"}`}
                      >
                        {f.status === "open" ? "截止報名" : "重新開放"}
                      </button>
                    </div>
                  </div>
                );
              })}
            {db.flights.length === 0 && (
              <div className="panel text-dim px-5 py-10 text-center text-sm">還沒有航班，往下開第一班吧。</div>
            )}
          </div>
        )}

        <CreateFlightForm />

        <div className="mt-10 border-t border-seam pt-4">
          <button
            onClick={() => {
              if (confirm("確定要重置所有示範資料嗎？此動作無法復原。")) resetDemo();
            }}
            className="btn btn-danger px-3 py-1.5 text-xs"
          >
            RESET DEMO DATA · 重置示範資料
          </button>
          <p className="text-dim mt-2 text-[11px] leading-relaxed">
            Phase 1 原型：資料存在瀏覽器 localStorage（跨分頁即時同步，換裝置不共享）。Phase 2 將改接 Supabase。
          </p>
        </div>
      </AdminGate>
    </BoardShell>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { BoardHeader, BoardShell, Loading, SectionTitle } from "@/components/Chrome";
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

function L({ children }: { children: React.ReactNode }) {
  return <span className="text-sub mb-1.5 block text-[13px] font-medium">{children}</span>;
}

function CreateFlightForm() {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [departLocal, setDepartLocal] = useState(defaultDepart);
  const [endLocal, setEndLocal] = useState("");
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
      setError(`活動代號 ${code.trim().toUpperCase()} 已存在，請換一個。`);
      return;
    }
    const depart = new Date(departLocal);
    if (isNaN(depart.getTime())) {
      setError("請選擇有效的日期時間。");
      return;
    }
    const end = endLocal ? new Date(endLocal) : null;
    if (end && (isNaN(end.getTime()) || end <= depart)) {
      setError("結束時間需要晚於開始時間。");
      return;
    }
    const flight = createFlight({
      code: code.trim(),
      title: title.trim(),
      departAt: depart.toISOString(),
      endAt: end ? end.toISOString() : undefined,
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
    <div className="card mt-6 p-6">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-[17px] font-bold">＋ 開新活動</span>
        <span className="text-sub">{open ? "收合 ▲" : "展開 ▼"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <L>活動名稱 *</L>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" placeholder="2026 年終尾牙" required />
          </label>

          <label className="block">
            <L>日期時間（開席）*</L>
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
            <L>結束時間（選填）</L>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="field-input"
            />
          </label>

          <label className="block">
            <L>活動代號 *</L>
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
            <L>餐廳名稱 *</L>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className="field-input" placeholder="饗宴會館" required />
          </label>
          <label className="block">
            <L>餐廳地址</L>
            <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="field-input" placeholder="台北市…" />
          </label>

          <label className="block">
            <L>登機門（樓層 / 包廂）</L>
            <input value={gate} onChange={(e) => setGate(e.target.value)} className="field-input" placeholder="2F 宴會廳" />
          </label>
          <label className="block">
            <L>出發地顯示文字</L>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} className="field-input" placeholder="OFFICE" />
          </label>

          <label className="block">
            <L>桌數</L>
            {numField(tableCount, setTableCount, 1, 60)}
          </label>
          <label className="block">
            <L>每桌座位數</L>
            {numField(seatsPerTable, setSeatsPerTable, 2, 20)}
          </label>
          <label className="block">
            <L>VIP 主桌數（由第 1 桌起算）</L>
            {numField(vipTables, setVipTables, 0, 10)}
          </label>
          <label className="block">
            <L>提前入場分鐘數</L>
            {numField(boardingMinutes, setBoardingMinutes, 0, 180)}
          </label>

          <label className="block sm:col-span-2">
            <L>備註（顯示在活動頁）</L>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" placeholder="備有素食桌…" />
          </label>

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <button type="submit" className="btn btn-primary">
              建立活動
            </button>
            <span className="text-sub text-[13px]">
              總座位：{tableCount} 桌 × {seatsPerTable} 位 ＝ {capacity} 席
            </span>
          </div>

          {error && <p className="tint tint-bad sm:col-span-2">{error}</p>}
          {createdCode && (
            <p className="tint tint-ok sm:col-span-2">
              ✓ 已建立 {createdCode} ——{" "}
              <Link href={`/flight/${createdCode}`} className="font-semibold underline">
                報名頁
              </Link>{" "}
              ·{" "}
              <Link href={`/admin/${createdCode}`} className="font-semibold underline">
                乘客名單
              </Link>
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** 主辦人後台首頁：活動列表 + 開新活動 */
export default function AdminPage() {
  const db = useDB();
  const hydrated = useHydrated();

  return (
    <BoardShell wide>
      <BoardHeader sub="主辦人後台" />
      <AdminGate>
        <SectionTitle en="FLIGHTS" zh="活動管理" />

        {!hydrated ? (
          <Loading />
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
                  <div key={f.id} className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-[16px] font-bold">{f.title}</span>
                        <span className="text-sub text-[13px]">{f.code}</span>
                        <span className={`pill ${f.status === "open" ? "pill-ok" : "pill-bad"}`}>
                          {f.status === "open" ? "開放中" : "已截止"}
                        </span>
                      </div>
                      <div className="text-sub mt-1 text-[13px]">
                        {fmtDate(f.departAt)} {fmtTime(f.departAt)} · {f.venueName} · 報名 {confirmed.length}/{cap}
                        {standby > 0 && ` · 候補 ${standby}`} · 已報到 {boarded}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/flight/${f.code}`} className="btn btn-secondary px-3.5 py-2 text-[13px]">
                        報名頁
                      </Link>
                      <Link href={`/admin/${f.code}`} className="btn btn-secondary px-3.5 py-2 text-[13px]">
                        乘客名單
                      </Link>
                      <Link href={`/admin/${f.code}/boarding`} className="btn btn-secondary px-3.5 py-2 text-[13px]">
                        登機口
                      </Link>
                      <button
                        onClick={() => setFlightStatus(f.id, f.status === "open" ? "closed" : "open")}
                        className={`btn px-3.5 py-2 text-[13px] ${f.status === "open" ? "btn-danger" : "btn-secondary"}`}
                      >
                        {f.status === "open" ? "截止報名" : "重新開放"}
                      </button>
                    </div>
                  </div>
                );
              })}
            {db.flights.length === 0 && (
              <div className="card text-sub px-5 py-10 text-center text-[14px]">還沒有活動，往下開第一場吧。</div>
            )}
          </div>
        )}

        <CreateFlightForm />

        <div className="mt-8 border-t border-line pt-5">
          <button
            onClick={() => {
              if (confirm("確定要重置所有示範資料嗎？此動作無法復原。")) resetDemo();
            }}
            className="btn btn-danger px-3.5 py-2 text-[13px]"
          >
            重置示範資料
          </button>
          <p className="text-sub mt-2 text-[12px] leading-relaxed">
            Phase 1 原型：資料存在瀏覽器 localStorage（跨分頁即時同步，換裝置不共享）。Phase 2 將改接 Supabase。
          </p>
        </div>
      </AdminGate>
    </BoardShell>
  );
}

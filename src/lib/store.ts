"use client";

/**
 * Phase 1 的 mock 資料層：資料存在瀏覽器 localStorage。
 *
 * 所有頁面只透過這個模組的 API 存取資料——Phase 2 接 Supabase 時，
 * 只要把這裡的實作換成 supabase-js 呼叫，UI 完全不用動。
 */

import { useSyncExternalStore } from "react";
import { seedDB } from "./seed";
import type { Attendee, DB, Flight, Meal } from "./types";
import { flightCapacity } from "./types";

export { useHydrated } from "./client";

const LS_KEY = "dinner-checkin:v1";
const EMPTY_DB: DB = { flights: [], attendees: [] };

let state: DB = load();
const listeners = new Set<() => void>();

function load(): DB {
  if (typeof window === "undefined") return EMPTY_DB;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (Array.isArray(parsed.flights) && Array.isArray(parsed.attendees)) return parsed;
    }
  } catch {
    // 壞資料就重新播種
  }
  const db = seedDB();
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {}
  return db;
}

function commit(next: DB) {
  state = next;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
}

// 跨分頁同步：後台開一個分頁、報名頁開另一個，操作即時互通
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY_DB);
}

// ── selectors ───────────────────────────────────────────────

export function flightByCode(db: DB, code: string): Flight | undefined {
  return db.flights.find((f) => f.code.toLowerCase() === code.toLowerCase());
}

/** 有效名單（排除已取消），依報名時間排序 */
export function attendeesOf(db: DB, flightId: string): Attendee[] {
  return db.attendees
    .filter((a) => a.flightId === flightId && a.status !== "cancelled")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function confirmedOf(db: DB, flightId: string): Attendee[] {
  return attendeesOf(db, flightId).filter((a) => a.status === "confirmed");
}

export function standbyOf(db: DB, flightId: string): Attendee[] {
  return attendeesOf(db, flightId).filter((a) => a.status === "standby");
}

export function takenSeats(db: DB, flightId: string): Map<string, Attendee> {
  const map = new Map<string, Attendee>();
  for (const a of confirmedOf(db, flightId)) if (a.seat) map.set(a.seat, a);
  return map;
}

export function byToken(db: DB, token: string): Attendee | undefined {
  return db.attendees.find((a) => a.passToken.toLowerCase() === token.toLowerCase());
}

// ── actions ─────────────────────────────────────────────────

const TOKEN_ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genToken(flightCode: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  bytes.forEach((b) => (suffix += TOKEN_ABC[b % TOKEN_ABC.length]));
  return `${flightCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase()}-${suffix}`;
}

export interface NewFlight {
  code: string;
  title: string;
  departAt: string;
  boardingMinutes: number;
  origin: string;
  venueName: string;
  venueAddress: string;
  gate: string;
  tableCount: number;
  seatsPerTable: number;
  vipTables: number;
  notes?: string;
}

export function createFlight(input: NewFlight): Flight {
  const flight: Flight = {
    id: crypto.randomUUID(),
    code: input.code.toUpperCase(),
    title: input.title,
    departAt: input.departAt,
    boardingMinutes: input.boardingMinutes,
    origin: input.origin || "OFFICE",
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    gate: input.gate,
    tables: Array.from({ length: input.tableCount }, (_, i) => ({
      label: String(i + 1),
      seats: input.seatsPerTable,
      ...(i < input.vipTables ? { vip: true } : {}),
    })),
    status: "open",
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  commit({ ...state, flights: [...state.flights, flight] });
  return flight;
}

export function setFlightStatus(flightId: string, status: Flight["status"]) {
  commit({
    ...state,
    flights: state.flights.map((f) => (f.id === flightId ? { ...f, status } : f)),
  });
}

export interface NewAttendee {
  flightId: string;
  name: string;
  dept?: string;
  meal: Meal;
  mealNote?: string;
  seat?: string;
}

export type SignupResult =
  | { ok: true; attendee: Attendee }
  | { ok: false; reason: "seat-taken" | "flight-missing" };

/** 報名。滿了自動轉候補；座位若剛好被搶走則回報失敗讓使用者重選。 */
export function addAttendee(input: NewAttendee): SignupResult {
  const flight = state.flights.find((f) => f.id === input.flightId);
  if (!flight) return { ok: false, reason: "flight-missing" };

  const confirmed = confirmedOf(state, flight.id);
  const full = confirmed.length >= flightCapacity(flight);

  let seat = input.seat;
  let status: Attendee["status"] = "confirmed";
  if (full) {
    seat = undefined;
    status = "standby";
  } else if (seat && takenSeats(state, flight.id).has(seat)) {
    return { ok: false, reason: "seat-taken" };
  }

  const attendee: Attendee = {
    id: crypto.randomUUID(),
    flightId: flight.id,
    name: input.name.trim(),
    dept: input.dept?.trim() || undefined,
    meal: input.meal,
    mealNote: input.mealNote?.trim() || undefined,
    seat,
    status,
    passToken: genToken(flight.code),
    createdAt: new Date().toISOString(),
  };
  commit({ ...state, attendees: [...state.attendees, attendee] });
  return { ok: true, attendee };
}

function patchAttendee(id: string, patch: Partial<Attendee>) {
  commit({
    ...state,
    attendees: state.attendees.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  });
}

/** 幫已確認但沒座位的人（例如候補遞補上來）選位 */
export function assignSeat(attendeeId: string, seat: string): boolean {
  const attendee = state.attendees.find((a) => a.id === attendeeId);
  if (!attendee) return false;
  if (takenSeats(state, attendee.flightId).has(seat)) return false;
  patchAttendee(attendeeId, { seat });
  return true;
}

export function cancelAttendee(attendeeId: string) {
  patchAttendee(attendeeId, { status: "cancelled", seat: undefined, checkedInAt: undefined });
}

/** 候補 → 確認（座位由本人或主辦人再選） */
export function promoteStandby(attendeeId: string) {
  patchAttendee(attendeeId, { status: "confirmed" });
}

export function setBoarded(attendeeId: string, boarded: boolean) {
  patchAttendee(attendeeId, { checkedInAt: boarded ? new Date().toISOString() : undefined });
}

export type ScanResult =
  | { kind: "ok"; attendee: Attendee }
  | { kind: "already"; attendee: Attendee }
  | { kind: "standby"; attendee: Attendee }
  | { kind: "wrong-flight"; attendee: Attendee }
  | { kind: "invalid" };

/** 登機口掃描：驗證登機證並完成報到 */
export function checkInByToken(token: string, flightId: string): ScanResult {
  const attendee = byToken(state, token.trim());
  if (!attendee || attendee.status === "cancelled") return { kind: "invalid" };
  if (attendee.flightId !== flightId) return { kind: "wrong-flight", attendee };
  if (attendee.status === "standby") return { kind: "standby", attendee };
  if (attendee.checkedInAt) return { kind: "already", attendee };
  patchAttendee(attendee.id, { checkedInAt: new Date().toISOString() });
  return { kind: "ok", attendee: { ...attendee, checkedInAt: new Date().toISOString() } };
}

/** 重置示範資料（管理後台的工具） */
export function resetDemo() {
  commit(seedDB());
}

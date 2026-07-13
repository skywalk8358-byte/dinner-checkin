"use client";

/**
 * Phase 1 的 mock 資料層：資料存在瀏覽器 localStorage。
 *
 * 所有頁面只透過這個模組的 API 存取資料——Phase 2 接 Supabase 時，
 * 只要把這裡的實作換成 supabase-js 呼叫，UI 完全不用動。
 */

import { useSyncExternalStore } from "react";
import { seedDB } from "./seed";
import type { Attendee, DB, Flight, Invite } from "./types";
import { flightCapacity } from "./types";

export { useHydrated } from "./client";

// v3：新增接龍名單（invites）與群組報名，換 key 讓舊快取自動重播種子
const LS_KEY = "dinner-checkin:v3";
const EMPTY_DB: DB = { flights: [], attendees: [], invites: [] };

let state: DB = load();
const listeners = new Set<() => void>();

function load(): DB {
  if (typeof window === "undefined") return EMPTY_DB;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (Array.isArray(parsed.flights) && Array.isArray(parsed.attendees) && Array.isArray(parsed.invites)) {
        return parsed;
      }
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

/** 同一次報名的同行者（含本人），已取消的不算 */
export function groupOf(db: DB, attendee: Attendee): Attendee[] {
  if (!attendee.groupId) return [attendee];
  return db.attendees.filter((a) => a.groupId === attendee.groupId && a.status !== "cancelled");
}

// ── 接龍名單（邀請） ─────────────────────────────────────

export function invitesOf(db: DB, flightId: string): Invite[] {
  return db.invites
    .filter((i) => i.flightId === flightId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function inviteByName(db: DB, flightId: string, name: string): Invite | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return invitesOf(db, flightId).find((i) => i.name.toLowerCase() === q);
}

/** 這筆接龍名額已被用掉幾位（已取消的還回去） */
export function inviteUsed(db: DB, inviteId: string): number {
  return db.attendees.filter((a) => a.inviteId === inviteId && a.status !== "cancelled").length;
}

/** 匯入接龍名單：同名字就更新名額，其餘新增；回傳筆數統計 */
export function importInvites(flightId: string, entries: { name: string; quota: number }[]): {
  added: number;
  updated: number;
} {
  let added = 0;
  let updated = 0;
  let invites = [...state.invites];
  for (const e of entries) {
    const name = e.name.trim();
    if (!name) continue;
    const existing = invites.find((i) => i.flightId === flightId && i.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.quota !== e.quota) {
        invites = invites.map((i) => (i.id === existing.id ? { ...i, quota: e.quota } : i));
        updated += 1;
      }
    } else {
      invites.push({
        id: crypto.randomUUID(),
        flightId,
        name,
        quota: e.quota,
        createdAt: new Date().toISOString(),
      });
      added += 1;
    }
  }
  commit({ ...state, invites });
  return { added, updated };
}

export function setInviteQuota(inviteId: string, quota: number) {
  commit({
    ...state,
    invites: state.invites.map((i) => (i.id === inviteId ? { ...i, quota: Math.max(1, quota) } : i)),
  });
}

export function deleteInvite(inviteId: string) {
  commit({ ...state, invites: state.invites.filter((i) => i.id !== inviteId) });
}

export function setInviteOnly(flightId: string, inviteOnly: boolean) {
  commit({
    ...state,
    flights: state.flights.map((f) => (f.id === flightId ? { ...f, inviteOnly } : f)),
  });
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
  endAt?: string;
  boardingMinutes: number;
  origin: string;
  venueName: string;
  venueAddress: string;
  gate: string;
  tableCount: number;
  seatsPerTable: number;
  vipTables: number;
  inviteOnly?: boolean;
  notes?: string;
}

export function createFlight(input: NewFlight): Flight {
  const flight: Flight = {
    id: crypto.randomUUID(),
    code: input.code.toUpperCase(),
    title: input.title,
    departAt: input.departAt,
    endAt: input.endAt,
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
    inviteOnly: input.inviteOnly,
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

export interface GroupSignup {
  flightId: string;
  /** 接龍模式必填：用哪一筆接龍名額 */
  inviteId?: string;
  /** 這次一起報名的所有人（第一位是主報名者） */
  people: { name: string; industry?: string }[];
  /** 備註（忌口等），記在主報名者身上 */
  note?: string;
  /** 與 people 一一對應的座位；候補時傳空陣列 */
  seats: string[];
}

export type GroupResult =
  | { ok: true; attendees: Attendee[] }
  | {
      ok: false;
      reason: "flight-missing" | "invite-required" | "quota-exceeded" | "seat-taken" | "seat-mismatch" | "not-enough-seats";
    };

/**
 * 群組報名（1 人也走這裡）。接龍模式會硬性檢查名額：
 * 接龍寫 +1 就只能報 2 位，想多報直接擋下。
 */
export function addGroup(input: GroupSignup): GroupResult {
  const flight = state.flights.find((f) => f.id === input.flightId);
  if (!flight) return { ok: false, reason: "flight-missing" };
  const people = input.people
    .map((p) => ({ name: p.name.trim(), industry: p.industry?.trim() || undefined }))
    .filter((p) => p.name);
  if (people.length === 0) return { ok: false, reason: "seat-mismatch" };

  // 接龍名額檢查
  if (flight.inviteOnly) {
    const invite = input.inviteId ? state.invites.find((i) => i.id === input.inviteId) : undefined;
    if (!invite || invite.flightId !== flight.id) return { ok: false, reason: "invite-required" };
    if (inviteUsed(state, invite.id) + people.length > invite.quota) {
      return { ok: false, reason: "quota-exceeded" };
    }
  }

  const isStandby = input.seats.length === 0;
  if (!isStandby) {
    if (input.seats.length !== people.length) return { ok: false, reason: "seat-mismatch" };
    if (new Set(input.seats).size !== input.seats.length) return { ok: false, reason: "seat-taken" };
    const taken = takenSeats(state, flight.id);
    if (input.seats.some((s) => taken.has(s))) return { ok: false, reason: "seat-taken" };
    if (confirmedOf(state, flight.id).length + people.length > flightCapacity(flight)) {
      return { ok: false, reason: "not-enough-seats" };
    }
  }

  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const created: Attendee[] = people.map((p, i) => ({
    id: crypto.randomUUID(),
    flightId: flight.id,
    name: p.name,
    industry: p.industry,
    note: i === 0 ? input.note?.trim() || undefined : undefined,
    seat: isStandby ? undefined : input.seats[i],
    inviteId: flight.inviteOnly ? input.inviteId : undefined,
    groupId,
    status: isStandby ? "standby" : "confirmed",
    passToken: genToken(flight.code),
    createdAt: now,
  }));
  commit({ ...state, attendees: [...state.attendees, ...created] });
  return { ok: true, attendees: created };
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

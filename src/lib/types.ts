/**
 * 核心資料模型 —— Phase 2 接 Supabase 時，這些型別直接對應資料表。
 */

export interface TableConfig {
  /** 桌號，如 "1"、"2" —— 座位代號 = 桌號 + 字母，例如 3F = 第 3 桌 F 位 */
  label: string;
  /** 這桌幾個座位 */
  seats: number;
  /** 主桌 / VIP 桌 */
  vip?: boolean;
}

export interface Flight {
  id: string;
  /** 航班代號，如 DN-0812 */
  code: string;
  /** 活動名稱 */
  title: string;
  /** 開始時間 (ISO) */
  departAt: string;
  /** 結束時間 (ISO)，選填；跨到隔天 00:00 會顯示成 24:00 */
  endAt?: string;
  /** 提前入場（登機）分鐘數 */
  boardingMinutes: number;
  /** 出發地顯示文字，如 OFFICE */
  origin: string;
  venueName: string;
  venueAddress: string;
  /** 登機門：樓層 / 包廂 */
  gate: string;
  tables: TableConfig[];
  status: "open" | "closed";
  /** 接龍模式：只有邀請名單（LINE 接龍）上的名字能報名，且不能超過各自名額 */
  inviteOnly?: boolean;
  notes?: string;
  createdAt: string;
}

/** 接龍名單（邀請）：一列接龍 = 一個名字 + 名額 */
export interface Invite {
  id: string;
  flightId: string;
  /** 接龍上的名字（主報名者） */
  name: string;
  /** 名額（含本人），例如「王大明 +1」= 2 */
  quota: number;
  createdAt: string;
}

export interface Attendee {
  id: string;
  flightId: string;
  name: string;
  /** 產業 / 領域 */
  industry?: string;
  /** 備註（忌口、過敏等） */
  note?: string;
  /** 座位代號，如 "3F"；候補或尚未選位時為空 */
  seat?: string;
  /** 使用哪一筆接龍名額報進來的 */
  inviteId?: string;
  /** 一起報名的同行群組（同一次報名共用一個 id） */
  groupId?: string;
  status: "confirmed" | "standby" | "cancelled";
  /** 已報到（登機）時間；未報到為空 */
  checkedInAt?: string;
  /** 登機證代碼（QR code 內容） */
  passToken: string;
  createdAt: string;
}

export interface DB {
  flights: Flight[];
  attendees: Attendee[];
  invites: Invite[];
}

/**
 * 解析 LINE 接龍文字 → 邀請名單。
 * 支援常見寫法：「1. 王大明 +1」「2、李小美 2位」「陳大文」「王big明 3」
 */
export function parseInviteText(text: string): { name: string; quota: number }[] {
  const out: { name: string; quota: number }[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    // 去掉開頭的接龍編號與符號：「12.」「3、」「(5)」「- 」等
    const line = rawLine.trim().replace(/^[\s\-–—•·*]*\(?\d+\)?[.、,)]\s*/, "").trim();
    if (!line) continue;

    let quota = 1;
    const plus = line.match(/\+\s*(\d+)/);
    const wei = line.match(/(\d+)\s*位/);
    const tail = line.match(/\s(\d+)$/);
    if (plus) quota = 1 + Number(plus[1]);
    else if (wei) quota = Number(wei[1]);
    else if (tail) quota = Number(tail[1]);

    const name = line
      .replace(/\+\s*\d+/, "")
      .replace(/\d+\s*位/, "")
      .replace(/\s\d+$/, "")
      .trim();
    if (!name) continue;
    out.push({ name, quota: Math.max(1, Math.min(20, quota)) });
  }
  return out;
}

/** 座位字母：跳過 I、O，避免跟 1、0 混淆（真的航空公司也這樣做） */
export const SEAT_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function tableSeatCodes(t: TableConfig): string[] {
  return Array.from({ length: Math.min(t.seats, SEAT_LETTERS.length) }, (_, i) => `${t.label}${SEAT_LETTERS[i]}`);
}

export function flightCapacity(f: Flight): number {
  return f.tables.reduce((n, t) => n + t.seats, 0);
}

export function splitSeat(seat: string): { table: string; letter: string } {
  const m = seat.match(/^(.+?)([A-Z])$/);
  return m ? { table: m[1], letter: m[2] } : { table: seat, letter: "" };
}

/** 航班目前的顯示狀態 */
export type FlightPhase = "open" | "standby" | "boarding" | "departed" | "closed";

export function flightPhase(f: Flight, confirmedCount: number, now: Date): FlightPhase {
  const dep = new Date(f.departAt).getTime();
  if (now.getTime() > dep) return "departed";
  if (f.status === "closed") return "closed";
  if (now.getTime() >= dep - f.boardingMinutes * 60_000) return "boarding";
  if (confirmedCount >= flightCapacity(f)) return "standby";
  return "open";
}

export const PHASE_LABEL: Record<FlightPhase, { en: string; zh: string; tone: "ok" | "warn" | "bad" | "dim" }> = {
  open: { en: "CHECK-IN OPEN", zh: "開放報名", tone: "ok" },
  standby: { en: "STANDBY ONLY", zh: "候補中", tone: "warn" },
  boarding: { en: "BOARDING", zh: "入場中", tone: "ok" },
  departed: { en: "DEPARTED", zh: "已開席", tone: "dim" },
  closed: { en: "CLOSED", zh: "已截止", tone: "bad" },
};

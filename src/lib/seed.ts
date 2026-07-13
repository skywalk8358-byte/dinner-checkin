import type { Attendee, DB, Flight, TableConfig } from "./types";

/** 示範登機證代碼 —— 可直接開 /pass/DN0812-DEMO01 看效果 */
export const DEMO_PASS_TOKEN = "DN0812-DEMO01";

function iso(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** 固定日期（使用者瀏覽器的當地時間） */
function at(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function tables(n: number, seats: number, vip = 0): TableConfig[] {
  return Array.from({ length: n }, (_, i) => ({
    label: String(i + 1),
    seats,
    ...(i < vip ? { vip: true } : {}),
  }));
}

let seq = 0;
function mk(
  flightId: string,
  tokenPrefix: string,
  name: string,
  industry: string,
  seat?: string,
  extra: Partial<Attendee> = {},
): Attendee {
  seq += 1;
  return {
    id: `a-${flightId}-${seq}`,
    flightId,
    name,
    industry,
    seat,
    status: "confirmed",
    passToken: `${tokenPrefix}-S${String(seq).padStart(3, "0")}`,
    createdAt: iso(-3, 9, seq),
    ...extra,
  };
}

export function seedDB(): DB {
  seq = 0;

  // 主活動：19 張站桌 × 5 位 = 95 席
  const f1: Flight = {
    id: "f-0812",
    code: "DN-0812",
    title: "二代學里民微醺罰站日",
    departAt: at(2026, 8, 12, 20, 0),
    endAt: at(2026, 8, 13, 0, 0),
    boardingMinutes: 30,
    origin: "OFFICE",
    venueName: "新村站著吃烤肉",
    venueAddress: "台中PARK2店",
    gate: "PARK2 草悟廣場",
    tables: tables(19, 5),
    status: "open",
    notes:
      "⭐️ 飲酒適量，請注意安全回家\n⭐️ 參與人數越多低消金額越低哦\n⭐️ 給予大家更多的線下交流時間",
    createdAt: iso(-7, 10),
  };

  const f2: Flight = {
    id: "f-next",
    code: "DN-0919",
    title: "九月里民小聚（暫定）",
    departAt: at(2026, 9, 19, 19, 0),
    boardingMinutes: 20,
    origin: "OFFICE",
    venueName: "地點徵集中",
    venueAddress: "",
    gate: "現場公告",
    tables: tables(4, 8),
    status: "closed",
    createdAt: iso(-2, 10),
  };

  const f3: Flight = {
    id: "f-past",
    code: "DN-0620",
    title: "六月里民小聚",
    departAt: iso(-23, 19, 0),
    boardingMinutes: 30,
    origin: "OFFICE",
    venueName: "貳樓餐廳",
    venueAddress: "台中市西區公益路 111 號",
    gate: "2F",
    tables: tables(6, 6),
    status: "open",
    createdAt: iso(-40, 10),
  };

  const attendees: Attendee[] = [
    mk(f1.id, "DN0812", "王大明", "餐飲業", "1A"),
    mk(f1.id, "DN0812", "林怡君", "科技業", "1B"),
    mk(f1.id, "DN0812", "陳志豪", "金融業", "1C", { passToken: DEMO_PASS_TOKEN }),
    mk(f1.id, "DN0812", "張雅婷", "行銷媒體", "1D"),
    mk(f1.id, "DN0812", "李國華", "製造業", "2A", { note: "海鮮過敏" }),
    mk(f1.id, "DN0812", "黃淑芬", "醫療業", "2B"),
    mk(f1.id, "DN0812", "吳建宏", "房地產", "2C"),
    mk(f1.id, "DN0812", "蔡佩珊", "電商", "3A"),
    mk(f1.id, "DN0812", "許家豪", "設計業", "3B", { note: "不吃牛" }),
    mk(f1.id, "DN0812", "鄭麗文", "法律", "3C"),
  ];

  return { flights: [f1, f2, f3], attendees };
}

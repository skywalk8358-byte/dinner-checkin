import type { Attendee, DB, Flight, Meal, TableConfig } from "./types";

/** 示範登機證代碼 —— 可直接開 /pass/DN0808-DEMO01 看效果 */
export const DEMO_PASS_TOKEN = "DN0808-DEMO01";

function iso(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
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
  dept: string,
  meal: Meal,
  seat?: string,
  extra: Partial<Attendee> = {},
): Attendee {
  seq += 1;
  return {
    id: `a-${flightId}-${seq}`,
    flightId,
    name,
    dept,
    meal,
    seat,
    status: "confirmed",
    passToken: `${tokenPrefix}-S${String(seq).padStart(3, "0")}`,
    createdAt: iso(-3, 9, seq),
    ...extra,
  };
}

export function seedDB(): DB {
  seq = 0;

  const f1: Flight = {
    id: "f-0808",
    code: "DN-0808",
    title: "Q3 全員聚餐 · 夏日感謝祭",
    departAt: iso(9, 18, 30),
    boardingMinutes: 30,
    origin: "OFFICE",
    venueName: "欣葉台菜 · 中山店",
    venueAddress: "台北市中山區雙城街 34-1 號",
    gate: "3F 宴會廳 A",
    tables: tables(6, 10, 1),
    status: "open",
    notes: "備有素食桌；特殊飲食需求請於報名時註明。",
    createdAt: iso(-14, 10),
  };

  const f2: Flight = {
    id: "f-0725",
    code: "DN-0725",
    title: "新人歡迎會",
    departAt: iso(12, 19, 0),
    boardingMinutes: 20,
    origin: "OFFICE",
    venueName: "乾杯燒肉 · 信義店",
    venueAddress: "台北市信義區松壽路 12 號",
    gate: "B1 包廂 3",
    tables: tables(3, 8),
    status: "open",
    createdAt: iso(-7, 10),
  };

  const f3: Flight = {
    id: "f-0620",
    code: "DN-0620",
    title: "端午節聚餐",
    departAt: iso(-23, 18, 0),
    boardingMinutes: 30,
    origin: "OFFICE",
    venueName: "點水樓 · 南京店",
    venueAddress: "台北市松山區南京東路四段 61 號",
    gate: "2F 大廳",
    tables: tables(4, 10),
    status: "open",
    createdAt: iso(-40, 10),
  };

  const attendees: Attendee[] = [
    // ── DN-0808：第 1 桌是 VIP 主桌 ──
    mk(f1.id, "DN0808", "王大明", "總經理室", "standard", "1A"),
    mk(f1.id, "DN0808", "林怡君", "總經理室", "veg", "1B"),
    mk(f1.id, "DN0808", "陳志豪", "研發部", "standard", "2A", { passToken: DEMO_PASS_TOKEN }),
    mk(f1.id, "DN0808", "張雅婷", "研發部", "standard", "2B"),
    mk(f1.id, "DN0808", "李國華", "研發部", "special", "2C", { mealNote: "海鮮過敏" }),
    mk(f1.id, "DN0808", "黃淑芬", "行銷部", "veg", "3A"),
    mk(f1.id, "DN0808", "吳建宏", "行銷部", "standard", "3B"),
    mk(f1.id, "DN0808", "蔡佩珊", "業務部", "standard", "3C"),
    mk(f1.id, "DN0808", "許家豪", "業務部", "standard", "3D"),
    mk(f1.id, "DN0808", "鄭麗文", "人資部", "veg", "4A"),
    mk(f1.id, "DN0808", "劉冠廷", "財務部", "standard", "4B"),
    mk(f1.id, "DN0808", "楊靜宜", "財務部", "standard", "4C"),
    // ── DN-0725 ──
    mk(f2.id, "DN0725", "周孟儒", "研發部", "standard", "1A"),
    mk(f2.id, "DN0725", "簡子晴", "研發部", "veg", "1B"),
    mk(f2.id, "DN0725", "郭哲瑋", "業務部", "standard", "2A"),
  ];

  return { flights: [f1, f2, f3], attendees };
}

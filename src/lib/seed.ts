import type { Attendee, DB, Flight, Invite, TableConfig } from "./types";

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

export function seedDB(): DB {
  // 主活動：19 張站桌 × 5 位 = 95 席，接龍模式
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
    inviteOnly: true,
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

  // ── 接龍名單與已報名者 ──
  let inviteSeq = 0;
  let seq = 0;
  const invites: Invite[] = [];
  const attendees: Attendee[] = [];

  /** 建一筆接龍名額，並讓 members 依序入座（第一位是主報名者） */
  function chain(
    quota: number,
    members: { name: string; industry: string; seat: string; note?: string; token?: string }[],
  ) {
    inviteSeq += 1;
    const invite: Invite = {
      id: `inv-${inviteSeq}`,
      flightId: f1.id,
      name: members[0]?.name ?? `保留 ${inviteSeq}`,
      quota,
      createdAt: iso(-5, 12, inviteSeq),
    };
    invites.push(invite);
    const groupId = members.length ? `g-${inviteSeq}` : undefined;
    for (const m of members) {
      seq += 1;
      attendees.push({
        id: `a-${seq}`,
        flightId: f1.id,
        name: m.name,
        industry: m.industry,
        note: m.note,
        seat: m.seat,
        inviteId: invite.id,
        groupId,
        status: "confirmed",
        passToken: m.token ?? `DN0812-S${String(seq).padStart(3, "0")}`,
        createdAt: iso(-3, 9, seq),
      });
    }
  }

  /** 接龍上有名字、但還沒進來選位的人 */
  function pendingChain(name: string, quota: number) {
    inviteSeq += 1;
    invites.push({
      id: `inv-${inviteSeq}`,
      flightId: f1.id,
      name,
      quota,
      createdAt: iso(-5, 12, inviteSeq),
    });
  }

  chain(2, [
    { name: "王大明", industry: "餐飲業", seat: "1A" },
    { name: "林怡君", industry: "科技業", seat: "1B" },
  ]);
  chain(1, [{ name: "陳志豪", industry: "金融業", seat: "1C", token: DEMO_PASS_TOKEN }]);
  chain(1, [{ name: "張雅婷", industry: "行銷媒體", seat: "1D" }]);
  chain(2, [
    { name: "李國華", industry: "製造業", seat: "2A", note: "海鮮過敏" },
    { name: "黃淑芬", industry: "醫療業", seat: "2B" },
  ]);
  chain(1, [{ name: "吳建宏", industry: "房地產", seat: "2C" }]);
  chain(1, [{ name: "蔡佩珊", industry: "電商", seat: "3A" }]);
  chain(1, [{ name: "許家豪", industry: "設計業", seat: "3B", note: "不吃牛" }]);
  chain(1, [{ name: "鄭麗文", industry: "法律", seat: "3C" }]);

  // 接龍上還沒進來選位的：拿「林小美」試試群組報名（名額 2）
  pendingChain("林小美", 2);
  pendingChain("周天成", 1);
  pendingChain("陳美惠", 3);

  return { flights: [f1, f2, f3], attendees, invites };
}

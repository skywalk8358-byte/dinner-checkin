# Dinner Air 後端建置規格書

> 版本：v1.0（2026-07-13）｜來源分支：`claude/dinner-signup-system-eeo6dw`
> 線上 Demo：https://skywalk8358-byte.github.io/dinner-checkin/ ｜ Repo：https://github.com/skywalk8358-byte/dinner-checkin

---

## 1. 這個系統是什麼

航空 check-in 風格的**聚餐報名系統**。把一場聚餐包裝成一趟「航班」：主辦人開活動、匯入 LINE 接龍名單 → 參加者用接龍上的名字報名、在座位圖選位 → 拿到含 QR code 的登機證 → 活動當天主辦人掃 QR 完成報到。

第一場實際使用：**2026/08/12「二代學里民微醺罰站日」**（95 席，接龍名單制）。

### 名詞對照（前端 UI 都用航空術語，資料層是通用命名）

| UI 用語 | 資料層概念 |
|---|---|
| 航班 Flight / 活動代號 `DN-0812` | 一場聚餐活動 `flights` |
| 乘客 / 登機證 | 報名者 `attendees`，每人一張票（passToken + QR） |
| 接龍名單 | 邀請名額 `invites`（名字＋可報人數） |
| 座位 `3F` | 第 3 桌 F 位（桌號＋字母） |
| 登機 / BOARDED | 當天報到（`checked_in_at`） |
| 候補 STANDBY | 滿員後排隊 `status = 'standby'` |

---

## 2. 現況架構與交接範圍

### 現況（Phase 1，已完成）

- **Next.js 16（App Router）+ React 19 + Tailwind v4**，所有頁面都是 client component
- **資料層是 mock**：`src/lib/store.ts`，資料存瀏覽器 localStorage、跨分頁用 `storage` event 同步。**每個瀏覽器一份資料，使用者之間互不相通**——這就是需要後端的原因
- 前端所有頁面**只透過 `store.ts` 匯出的函式**讀寫資料，不直接碰儲存

### 交接目標（Phase 2）

把 `src/lib/store.ts` 的實作換成真後端，**UI 與頁面完全不動**。原定技術選型：**Supabase（Postgres + Realtime + Auth）+ Vercel 部署**（帳號都已備妥）；若你有其他偏好（自建 API）也可以，只要實作同一份合約（見 §5）。

### 關鍵檔案

| 檔案 | 內容 |
|---|---|
| `src/lib/types.ts` | 資料模型 + `parseInviteText`（接龍文字解析）+ phase 判斷 |
| `src/lib/store.ts` | **要被替換的資料層**：selectors + actions 全在這 |
| `src/lib/seed.ts` | 示範資料（欄位用法的實例參考） |
| `src/app/**` | 頁面（不用動） |
| `scripts/smoke.mjs` | Playwright 全流程測試（`npm run smoke`，改完後端必須全過） |

---

## 3. 資料模型

### 3.1 `flights`（活動）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | uuid | ✓ | 主鍵 |
| `code` | text | ✓ | 活動代號，如 `DN-0812`。**唯一**，URL 使用（`/flight/DN-0812`），比對不分大小寫 |
| `title` | text | ✓ | 活動名稱 |
| `depart_at` | timestamptz | ✓ | 開席時間 |
| `end_at` | timestamptz | | 結束時間（跨日 00:00 前端顯示成 24:00） |
| `boarding_minutes` | int | ✓ | 提前入場分鐘數（預設 30） |
| `origin` | text | ✓ | 出發地顯示文字（預設 `OFFICE`） |
| `venue_name` / `venue_address` | text | ✓/– | 餐廳名 / 地址 |
| `gate` | text | ✓ | 登機門（樓層/包廂） |
| `tables` | jsonb | ✓ | 桌位配置：`[{ "label": "1", "seats": 5, "vip": true? }, …]` |
| `status` | text | ✓ | `'open' \| 'closed'`（主辦人手動截止/重開） |
| `invite_only` | bool | ✓ | 接龍名單制開關（預設 false） |
| `notes` | text | | 注意事項（可多行，`\n` 分隔） |
| `created_at` | timestamptz | ✓ | |

衍生規則（前端已實作，後端不用存）：
- **容量** = `sum(tables[].seats)`
- **座位代號** = 桌號 + 字母，字母序列 `ABCDEFGHJKLMNPQRSTUVWXYZ`（**跳過 I、O**）。第 3 桌第 6 個位子 = `3F`
- **活動狀態 phase**（純顯示邏輯，由時間推導）：`departed`（now > depart_at）→ `closed`（手動）→ `boarding`（now ≥ depart_at − boarding_minutes）→ `standby`（正取數 ≥ 容量）→ `open`

### 3.2 `invites`（接龍名單）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | uuid | ✓ | |
| `flight_id` | uuid → flights | ✓ | |
| `name` | text | ✓ | 接龍上的名字（主報名者）。**同一活動內不分大小寫唯一** |
| `quota` | int | ✓ | 名額（含本人），1–20。「王大明 +1」= 2 |
| `created_at` | timestamptz | ✓ | |

### 3.3 `attendees`（報名者，一人一列）

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | uuid | ✓ | |
| `flight_id` | uuid → flights | ✓ | |
| `name` | text | ✓ | 姓名（1–30 字） |
| `industry` | text | | 產業（≤20 字） |
| `note` | text | | 備註/忌口（≤60 字）。**敏感欄位**（過敏資訊），僅主辦人可讀，見 §6.3 |
| `seat` | text | | 座位代號如 `3F`；候補或未選位為 null |
| `invite_id` | uuid → invites | | 用哪筆接龍名額報進來（invite_only 活動必填） |
| `group_id` | uuid | | 同一次報名的群組（一起報的人共用同一值） |
| `status` | text | ✓ | `'confirmed' \| 'standby' \| 'cancelled'` |
| `checked_in_at` | timestamptz | | 報到時間；null = 未報到 |
| `pass_token` | text | ✓ | 登機證代碼，**全域唯一**，即 QR 內容。格式 `<活動碼去符號>-<6碼>`，如 `DN0812-K4MMJN`，6 碼字元集 `ABCDEFGHJKMNPQRSTUVWXYZ23456789`（避開 0/O/1/I/L）。比對不分大小寫 |
| `created_at` | timestamptz | ✓ | |

---

## 4. 業務規則（後端必須強制執行的部分）

> 前端已做過一次檢查，但**前端檢查只是 UX**——所有規則在後端寫入時必須重新驗證，因為使用者可以繞過畫面直接打 API。

### 4.1 報名（`addGroup`）——系統核心，必須是**單一交易（atomic）**

輸入：`{ flightId, inviteId?, people: [{name, industry?}], note?, seats: string[] }`
- `people[0]` 是主報名者；`note` 只記在主報名者身上
- `seats` 與 `people` **一一對應**（第 i 個人坐第 i 個位子）；`seats = []` 代表候補

驗證順序與失敗代碼（前端依代碼顯示訊息，需保持一致）：

| 檢查 | 失敗代碼 |
|---|---|
| 活動存在且 `status = 'open'` 且未開席 | `flight-missing` |
| 過濾空白姓名後 `people` 至少 1 人 | `seat-mismatch` |
| **invite_only 活動**：`inviteId` 存在且屬於該活動 | `invite-required` |
| **名額**：`已用(該 invite 下非 cancelled 人數) + people.length ≤ invite.quota` | `quota-exceeded` |
| 非候補時：`seats.length === people.length`、無重複 | `seat-mismatch` / `seat-taken` |
| 每個座位未被佔用（confirmed 且同活動） | `seat-taken` |
| 正取總數 + people.length ≤ 容量 | `not-enough-seats` |

成功時：產生一個 `group_id`，為每個人建立一列 attendee（各自的 `pass_token`），全部 `confirmed`＋座位，或全部 `standby`＋無座位。**部分成功是不允許的**——任何一個座位被搶就整組失敗回滾。

> ⚠️ **競態是真實需求**：兩個人同時搶同一個座位、或同一筆接龍名額同時被用，靠資料庫約束＋交易擋，不能只靠先查再寫。建議把整個 addGroup 做成 Postgres function（RPC），見 §6.2。

### 4.2 座位唯一性

同一活動內，**一個座位同時只能屬於一個非取消的報名者**。建議用 partial unique index 當最後防線：

```sql
create unique index uniq_active_seat
  on attendees (flight_id, seat)
  where seat is not null and status <> 'cancelled';
```

### 4.3 補選位（`assignSeat`）

給「已是 confirmed 但沒座位」的人用（例如候補被遞補後）。輸入 attendeeId + seat；座位被佔就失敗。同樣受 4.2 約束保護。

### 4.4 取消（`cancelAttendee`）

`status → 'cancelled'`，同時**清空 `seat` 與 `checked_in_at`**。效果：
- 座位立即釋出（座位圖可再選）
- **接龍名額自動歸還**（因為名額計算只數非 cancelled）
- 已取消的登機證頁顯示「已取消」，不能報到（見 4.6）

### 4.5 候補與遞補

- 活動滿員（phase = standby）時，報名走候補：單人、無座位、`status = 'standby'`
- **遞補（`promoteStandby`）是主辦人手動操作**：standby → confirmed（仍無座位），之後本人從登機證頁進 `/flight/[code]/seat?pass=<token>` 自己選位
- 遞補時後端應驗證「正取數 < 容量」

### 4.6 報到（`checkInByToken`）——主辦人權限

輸入：掃到的 token + 當前活動 id。回傳代碼（前端據此顯示不同顏色的結果）：

| 情境 | 代碼 | 行為 |
|---|---|---|
| token 查無或已取消 | `invalid` | 不寫入 |
| 屬於別的活動 | `wrong-flight` | 不寫入 |
| 是候補票 | `standby` | 不寫入（請洽主辦人遞補） |
| 已報到過 | `already` | 不重複寫入 |
| 正常 | `ok` | 寫入 `checked_in_at = now()` |

另有手動開關 `setBoarded(attendeeId, boolean)`（名單頁勾選/取消報到）。

### 4.7 接龍名單匯入（`importInvites`）

輸入解析後的 `[{name, quota}]`（解析函式 `parseInviteText` 在前端 `types.ts`，支援「1. 王大明 +1」「李小美 2位」「陳大文 3」，quota 限 1–20）。寫入規則：**同活動同名（不分大小寫）→ 更新 quota；否則新增**。回傳 `{added, updated}`。

另有 `setInviteQuota(inviteId, quota)`（quota ≥ 1）、`deleteInvite(inviteId)`（刪名額**不**取消已報名者）、`setInviteOnly(flightId, bool)`。

### 4.8 活動管理

`createFlight`（含 tables 產生：桌數 × 每桌座位、前 N 桌 VIP）、`setFlightStatus(flightId, 'open'|'closed')`。活動代號重複要擋。

---

## 5. 前端資料層合約（`src/lib/store.ts` 要換掉的介面）

### 讀取（目前是同步 selector，改後端後轉為查詢＋訂閱）

| 函式 | 用途 | 使用頁面 |
|---|---|---|
| `useDB()` | 取得整包資料（flights/attendees/invites） | 所有頁面 |
| `flightByCode(code)` | 用代號找活動（不分大小寫） | 活動/報名/選位頁 |
| `confirmedOf / standbyOf / attendeesOf(flightId)` | 名單（依報名時間排序，排除 cancelled） | 各頁 |
| `takenSeats(flightId)` | `Map<座位, attendee>`（座位圖顯示名字用） | 選位頁 |
| `byToken(token)` | 用登機證代碼找人 | 登機證頁 |
| `groupOf(attendee)` | 同 group 的同行者（非 cancelled） | 登機證頁「同行旅客」 |
| `invitesOf(flightId)`、`inviteByName(flightId, name)`、`inviteUsed(inviteId)` | 接龍名單／名額查詢 | 報名頁、後台 |

### 寫入（見 §4 的規則）

`addGroup`、`assignSeat`、`cancelAttendee`、`promoteStandby`、`setBoarded`、`checkInByToken`、`createFlight`、`setFlightStatus`、`setInviteOnly`、`importInvites`、`setInviteQuota`、`deleteInvite`。（mock 專用的 `resetDemo` 正式版移除。）

### 即時性

Mock 版用 localStorage `storage` event 做跨分頁同步。正式版需求：**選位頁的座位圖**與**後台名單/報到計數**要能即時反映他人操作（Supabase Realtime 訂閱 `attendees`、`invites` 的變更即可；輪詢 5–10 秒也可接受，體驗稍差）。

---

## 6. 建議的 Supabase 實作

### 6.1 Schema

```sql
create table flights (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  depart_at timestamptz not null,
  end_at timestamptz,
  boarding_minutes int not null default 30,
  origin text not null default 'OFFICE',
  venue_name text not null,
  venue_address text not null default '',
  gate text not null default '現場公告',
  tables jsonb not null,
  status text not null default 'open' check (status in ('open','closed')),
  invite_only boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create unique index uniq_flight_code on flights (upper(code));

create table invites (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references flights(id) on delete cascade,
  name text not null,
  quota int not null check (quota between 1 and 20),
  created_at timestamptz not null default now()
);
create unique index uniq_invite_name on invites (flight_id, lower(name));

create table attendees (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid not null references flights(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  industry text check (char_length(industry) <= 20),
  note text check (char_length(note) <= 60),
  seat text,
  invite_id uuid references invites(id) on delete set null,
  group_id uuid,
  status text not null default 'confirmed' check (status in ('confirmed','standby','cancelled')),
  checked_in_at timestamptz,
  pass_token text not null,
  created_at timestamptz not null default now()
);
create unique index uniq_pass_token on attendees (upper(pass_token));
create unique index uniq_active_seat on attendees (flight_id, seat)
  where seat is not null and status <> 'cancelled';
create index idx_attendees_flight on attendees (flight_id, status);
```

### 6.2 `addGroup` 做成 RPC（重點）

名額與容量檢查無法用單純的 unique index 表達，放進一個 `security definer` 的 Postgres function，在同一交易內：鎖定該 invite（`select … for update`）→ 驗名額 → 驗容量 → insert 全部人（座位衝突由 `uniq_active_seat` 擋，捕捉 unique violation 轉成 `seat-taken`）。回傳建立的 attendees 或錯誤代碼。前端用 `supabase.rpc('add_group', …)` 呼叫。

`check_in_by_token`、`promote_standby` 同理各包一個小 RPC（或在 API route 內做，見 6.4）。

### 6.3 RLS（權限）草案

| 資料 | anon（一般參加者） | 主辦人（Auth 登入） |
|---|---|---|
| `flights` | 可讀 | 全權 |
| `invites` | 可讀 `name`、`quota`（報名頁要即時顯示名額） | 全權 |
| `attendees` | **可讀 `name / industry / seat / status / group_id / flight_id`**（座位圖公開顯示姓名是產品功能）；**`note` 與 `checked_in_at` 不公開**——用 view 或 column-level 處理 | 全權 |
| 寫入 | 僅能透過 RPC（`add_group` / `assign_seat`）；不可直接 insert/update | 直接操作或 admin RPC |

- 登機證頁用 `pass_token` 查自己那筆（含同行者）：做一個 `get_pass(token)` RPC，token 即是持有憑證（capability URL），可回傳本人完整資料＋同行者的 name/seat/token
- **主辦人驗證**：目前前端是寫死的通關碼 `0815`（`NEXT_PUBLIC_ADMIN_CODE`，純防誤闖）。正式版改 **Supabase Auth**（email 登入即可，主辦人就 1–2 人），`/admin` 相關頁與 admin 寫入全部改吃 session
- `cancelAttendee` 屬主辦人權限（參加者要取消請找主辦人，維持單純）

### 6.4 也可以不用 RPC？

如果偏好把邏輯寫在 Next.js API routes / server actions（用 service role key），也完全可行——規則照 §4，交易照 6.2 的精神做。選你熟的，**不變的是：檢查必須發生在伺服器端、寫入必須原子**。

---

## 7. 不在後端範圍（前端已處理，不用做）

- QR code **產生**（client SVG）與**掃描**（client 相機 + qr-scanner）
- 登機證版面、列印、CSV 匯出（client 端組字串下載）
- phase（開放報名/入場中/已開席…）的時間推導
- 接龍文字解析 `parseInviteText`（前端解析完才送 `importInvites`）

---

## 8. 驗收清單（Definition of Done）

功能面（`npm run smoke` 全綠是底線，另補多人情境）：

1. A 瀏覽器報名選位後，B 瀏覽器**看得到**（座位圖有名字、後台名單有人、剩餘席次正確）
2. 接龍名額 2 位的人：能報 1 或 2 位；報滿後再報被 `quota-exceeded` 擋；**兩個裝置同時用同一筆名額報 2 位，只有一邊成功**
3. 兩個裝置**同時選同一個座位**，只有一邊成功，另一邊收到 `seat-taken`
4. 不在接龍名單的名字在 invite_only 活動報名被 `invite-required` 擋
5. 取消後：座位釋出、名額歸還、該票變無效（掃描回 `invalid`）
6. 掃描報到五種情境（ok / already / standby / wrong-flight / invalid）回應正確
7. 遞補後本人可補選位
8. 匿名使用者**讀不到** `note`（忌口/過敏）與 `checked_in_at`；無法直接 insert/update attendees
9. 後台頁面未登入不可操作（Supabase Auth）
10. 部署：Vercel + 環境變數 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 9. 附錄

### 頁面地圖

| 路徑 | 誰用 | 做什麼 |
|---|---|---|
| `/` | 公開 | 活動列表 |
| `/flight/[code]` | 公開 | 活動資訊＋報名入口 |
| `/flight/[code]/checkin` | 公開 | 填姓名（接龍比對）/產業/備註 |
| `/flight/[code]/seat` | 公開 | 座位圖：多選（上限=名額）、同行者姓名、`?pass=` 補選位 |
| `/pass/[token]` | 持 token | 登機證＋QR＋同行者連結 |
| `/admin` | 主辦人 | 活動管理、開新活動 |
| `/admin/[code]` | 主辦人 | 名單/統計/遞補/取消/CSV/接龍名單匯入 |
| `/admin/[code]/boarding` | 主辦人 | QR 掃描報到＋手動名單 |

### 本機執行

```bash
npm install && npm run dev     # http://localhost:3000
npm run build && npm run start # production
npm run smoke                  # Playwright 全流程測試（需 server 先起）
```

有任何規則寫得不清楚的地方，直接看 `src/lib/store.ts`——它就是這份規格的可執行版本。

/**
 * 冒煙測試：跑完「看板 → 報名 → 選位 → 登機證 → 後台名單 → 登機口報到」全流程。
 * 先啟動 server（npm run dev 或 npm run build && npm run start），再執行 npm run smoke。
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = resolve(process.env.SHOT_DIR ?? "smoke-shots") + "/";
mkdirSync(OUT, { recursive: true });

const fail = (msg) => {
  console.error("✗ FAIL:", msg);
  process.exitCode = 1;
};

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  }
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => fail(`page error: ${e.message}`));

// 1. 出發看板
await page.goto(BASE + "/");
await page.waitForTimeout(2200); // 等翻牌動畫定格
await page.screenshot({ path: OUT + "01-departures.png", fullPage: true });
if (!(await page.getByText("DN-0812").first().isVisible())) fail("departures board missing DN-0812");
console.log("✓ departures board");

// 2. 航班頁
await page.getByText("DN-0812").first().click();
await page.waitForURL("**/flight/DN-0812");
await page.waitForTimeout(2200);
await page.screenshot({ path: OUT + "02-flight.png", fullPage: true });
if (!(await page.getByText("CHECK IN · 開始報名").isVisible())) fail("flight page missing check-in CTA");
console.log("✓ flight page");

// 3. 報名表單：林小美是接龍名單上的名字（名額 2），填完名字直接去選位
await page.getByText("CHECK IN · 開始報名").click();
await page.waitForURL("**/checkin");
await page.getByPlaceholder("王小明").fill("林小美");
await page.waitForTimeout(400);
if (!(await page.getByText(/接龍名額 2 位/).isVisible())) fail("invite quota hint missing");
await page.getByPlaceholder("例：餐飲、科技、金融").fill("設計業");
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "03-checkin-form.png", fullPage: true });
await page.getByText("NEXT · 前往選位").click();
console.log("✓ check-in form (invite)");

// 4. 選位：名額 2 位 → 直接點 5A + 5B，同行者姓名在確認列填
await page.waitForURL("**/seat");
await page.waitForTimeout(1500);
const seat = (code) =>
  page.locator("g").filter({ has: page.locator("title", { hasText: new RegExp(`^座位 ${code}$`) }) });
await seat("5A").click();
await seat("5B").click();
const confirmBtn = page.getByText("CONFIRM · 確認選位");
if (await confirmBtn.isEnabled()) fail("confirm should be disabled until companion name filled");
await page.getByPlaceholder("同行者姓名").fill("王小弟");
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "04-seatmap.png", fullPage: true });
await confirmBtn.click();
console.log("✓ seat selection (2 seats, companion named inline)");

// 5. 登機證（主報名者）＋同行旅客清單
await page.waitForURL("**/pass/**");
await page.waitForTimeout(1800);
await page.screenshot({ path: OUT + "05-boarding-pass.png", fullPage: true });
const passUrl = page.url();
if (!(await page.getByText("林小美").first().isVisible())) fail("pass missing passenger name");
if (!(await page.locator(".ticket").getByText("5A").first().isVisible())) fail("pass missing seat 5A");
if (!(await page.getByText("王小弟").first().isVisible())) fail("pass missing companion");
console.log("✓ boarding pass + companion:", passUrl);

// 手機尺寸的登機證
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(passUrl);
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: OUT + "06-pass-mobile.png", fullPage: true });
await mobile.close();
console.log("✓ mobile pass");

// 6. 後台（通關碼 0815）→ 乘客名單
await page.goto(BASE + "/admin/DN-0812");
await page.getByPlaceholder("••••").fill("0815");
await page.getByText("UNLOCK 解鎖").click();
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + "07-manifest.png", fullPage: true });
if (!(await page.getByText("林小美").first().isVisible())) fail("manifest missing new attendee");
console.log("✓ manifest");

// 7. 登機口：手動幫林小美報到
await page.goto(BASE + "/admin/DN-0812/boarding");
await page.waitForTimeout(1500);
await page.getByPlaceholder(/搜尋姓名/).fill("林小美");
await page.waitForTimeout(400);
await page.locator("button", { hasText: /^報到$/ }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + "08-boarding-gate.png", fullPage: true });
console.log("✓ boarding gate manual check-in");

// 8. 名額防呆：林小美的 2 位已用完，再報會被擋；不在名單上的名字會被警告
await page.goto(BASE + "/flight/DN-0812/checkin");
await page.getByPlaceholder("王小明").fill("林小美");
await page.waitForTimeout(400);
if (!(await page.getByText(/還可報 0 位/).isVisible())) fail("quota exhausted hint missing");
await page.getByText(/NEXT ·/).click();
await page.waitForTimeout(400);
if (!(await page.getByText(/已全部使用/).isVisible())) fail("quota block message missing");
await page.getByPlaceholder("王小明").fill("神秘客");
await page.waitForTimeout(400);
if (!(await page.getByText(/不在接龍名單上/).isVisible())) fail("not-on-list warning missing");
console.log("✓ quota enforcement (over-signup blocked)");

// 9. 報到後的登機證要蓋 BOARDED 章
await page.goto(passUrl);
await page.waitForTimeout(1800);
await page.screenshot({ path: OUT + "09-pass-boarded.png", fullPage: true });
if (!(await page.getByText("BOARDED").first().isVisible())) fail("pass missing BOARDED stamp");
console.log("✓ boarded stamp");

await browser.close();
console.log(process.exitCode ? "SMOKE TEST FAILED" : "ALL SMOKE TESTS PASSED");
